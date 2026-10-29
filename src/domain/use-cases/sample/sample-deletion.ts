import { ProjectResponseModel } from "../../entities/project";
import { PublicSampleModel } from "../../entities/sample";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { TaskLogger } from "../../interfaces/repositories/task-repository";

// Steps shared by the sample and project deletion tasks.

// What a deletion needs to act on the EcoTaxa side of a project: resolved once, before the samples.
export interface EcoTaxaCleanup {
    base_url: string;
    token: string;
    instance_name: string;
    ecotaxa_project_id: number;
}

// What to do with a sample whose EcoTaxa objects could not be deleted: keep it, so that the deletion
// can be retried once EcoTaxa answers (a sample deleted here could never be cleaned there any more), or
// go on and delete it on EcoPart anyway (its whole EcoTaxa project is about to be deleted).
export type EcoTaxaFailurePolicy = "keep sample" | "continue";

export function isLinkedToEcoTaxa(project: ProjectResponseModel): boolean {
    return !!project.ecotaxa_project_id && !!project.ecotaxa_instance_id;
}

// Returns null, after saying why in the log, when nothing can be deleted on EcoTaxa: the project is not
// linked, or no generic account can act on its instance. The samples are then deleted on EcoPart only.
export async function resolveEcoTaxaCleanup(ecotaxaAccountRepository: EcotaxaAccountRepository, project: ProjectResponseModel, log: TaskLogger): Promise<EcoTaxaCleanup | null> {
    if (!project.ecotaxa_project_id || !project.ecotaxa_instance_id) {
        await log("EcoTaxa : the project is not linked to an EcoTaxa project, nothing to delete there");
        return null;
    }
    const instance = await ecotaxaAccountRepository.getOneEcoTaxaInstance(project.ecotaxa_instance_id);
    if (!instance) {
        await log(`EcoTaxa : WARNING instance ${project.ecotaxa_instance_id} not found, the EcoTaxa objects and project are kept`);
        return null;
    }
    try {
        const account = await ecotaxaAccountRepository.getEcotaxaGenericAccountForInstance(project.ecotaxa_instance_id);
        await log(`EcoTaxa : linked to project ${project.ecotaxa_project_id} on ${instance.ecotaxa_instance_name}, acting with the generic account`);
        return {
            base_url: instance.ecotaxa_instance_url,
            token: account.ecotaxa_account_token,
            instance_name: instance.ecotaxa_instance_name,
            ecotaxa_project_id: project.ecotaxa_project_id,
        };
    } catch (error) {
        await log(`EcoTaxa : WARNING no generic account for ${instance.ecotaxa_instance_name}, the EcoTaxa objects and project are kept (${(error as Error).message})`);
        return null;
    }
}

// Deletes one sample: its EcoTaxa objects when it was imported there, then its database row, then its
// storage folder, each step logged. Throws at the first failing step; what was deleted before stays deleted.
// Returns the warnings of the steps that went on after a failure, for the task result.
export async function deleteOneSample(sampleRepository: SampleRepository, ecotaxaAccountRepository: EcotaxaAccountRepository, project_id: number, sample: PublicSampleModel, ecotaxa: EcoTaxaCleanup | null, on_ecotaxa_failure: EcoTaxaFailurePolicy, log: TaskLogger): Promise<string[]> {
    const name = `${sample.sample_name} (id ${sample.sample_id})`;
    const warnings: string[] = [];

    if (sample.ecotaxa_sample_imported) {
        if (ecotaxa) {
            try {
                const object_ids = await ecotaxaAccountRepository.api_ecotaxa_query_objects_by_sample(ecotaxa.base_url, ecotaxa.token, ecotaxa.ecotaxa_project_id, [sample.sample_name]);
                if (object_ids.length > 0) {
                    await ecotaxaAccountRepository.api_ecotaxa_delete_objects(ecotaxa.base_url, ecotaxa.token, object_ids);
                }
                await sampleRepository.deleteEcoTaxaSamplesFromDb([sample]);
                await log(`${name} : ${object_ids.length} object(s) deleted from EcoTaxa project ${ecotaxa.ecotaxa_project_id} on ${ecotaxa.instance_name}, sample marked as not imported`);
            } catch (error) {
                const reason = `EcoTaxa objects not deleted from project ${ecotaxa.ecotaxa_project_id} on ${ecotaxa.instance_name} (${(error as Error).message})`;
                if (on_ecotaxa_failure === "keep sample") {
                    throw new Error(`${reason}, the sample is kept`);
                }
                warnings.push(`${sample.sample_name} : ${reason}`);
                await log(`${name} : WARNING ${reason}, deleted on EcoPart anyway`);
            }
        } else {
            await log(`${name} : imported to EcoTaxa, its EcoTaxa objects are kept`);
        }
    }

    const deleted_rows = await sampleRepository.deleteSample({ sample_id: sample.sample_id });
    if (deleted_rows === 0) {
        throw new Error("Cannot delete sample");
    }
    await log(`${name} : database row deleted`);

    const removed = await sampleRepository.deleteSampleFromStorage(sample.sample_name, project_id);
    if (removed === 0) {
        throw new Error("Cannot delete sample from storage");
    }
    await log(`${name} : storage folder ${project_id}/${sample.sample_name} removed`);

    return warnings;
}
