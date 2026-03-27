import { PublicSampleModel } from "../../entities/sample";
import { UserUpdateModel } from "../../entities/user";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { DeleteSampleUseCase } from "../../interfaces/use-cases/sample/delete-sample";

export class DeleteSample implements DeleteSampleUseCase {
    userRepository: UserRepository
    sampleRepository: SampleRepository
    privilegeRepository: PrivilegeRepository
    ecotaxaAccountRepository: EcotaxaAccountRepository
    projectRepository: ProjectRepository

    constructor(userRepository: UserRepository, sampleRepository: SampleRepository, privilegeRepository: PrivilegeRepository, ecotaxaAccountRepository: EcotaxaAccountRepository, projectRepository: ProjectRepository) {
        this.userRepository = userRepository
        this.sampleRepository = sampleRepository
        this.privilegeRepository = privilegeRepository
        this.ecotaxaAccountRepository = ecotaxaAccountRepository
        this.projectRepository = projectRepository
    }

    async execute(current_user: UserUpdateModel, sample_id_to_delete: number, project_id?: number): Promise<void> {
        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Ensure the sample to delete exists
        const sample = await this.ensureSampleExists(sample_id_to_delete);

        // Ensure the project_id is valid if specified
        if (project_id && sample.project_id != project_id) {
            throw new Error("The given project_id does not match the sample's project_id");
        }

        // Ensure the current user has permission to delete the sample
        await this.ensureUserCanDelete(current_user, sample.project_id);

        // If the sample has been imported to EcoTaxa, clean up EcoTaxa objects first
        if (sample.ecotaxa_sample_imported) {
            await this.deleteEcoTaxaObjects(sample);
        }

        // Delete the sample
        await this.deleteSample(sample, sample.project_id);
    }

    // Ensure the sample to delete exists
    private async ensureSampleExists(sample_id: number): Promise<PublicSampleModel> {
        const result = await this.sampleRepository.getSample({ sample_id: sample_id });
        if (result === null) {
            throw new Error("Cannot find sample to delete");
        }
        return result;
    }

    // Ensure user is admin or has manager privilege to delete the sample
    private async ensureUserCanDelete(current_user: UserUpdateModel, project_id: number): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isManager({
            user_id: current_user.user_id,
            project_id: project_id
        });

        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot delete this sample");
        }
    }

    // Delete the sample
    private async deleteSample(sample: PublicSampleModel, project_id: number): Promise<void> {
        await this.deleteSampleFromDatabase(sample.sample_id);
        await this.deleteSampleFromStorage(sample.sample_name, project_id);
    }

    private async deleteSampleFromDatabase(sample_id: number): Promise<void> {
        const deletedSamplesCount = await this.sampleRepository.deleteSample({ sample_id: sample_id });
        if (deletedSamplesCount === 0) {
            throw new Error("Cannot delete sample");
        }
    }

    private async deleteSampleFromStorage(sample_name: string, project_id: number): Promise<void> {
        const deletedSamplesCount = await this.sampleRepository.deleteSampleFromStorage(sample_name, project_id);
        if (deletedSamplesCount === 0) {
            throw new Error("Cannot delete sample");
        }
    }

    // Delete EcoTaxa objects associated with a sample
    private async deleteEcoTaxaObjects(sample: PublicSampleModel): Promise<void> {
        const project = await this.projectRepository.getProject({ project_id: sample.project_id });
        if (!project || !project.ecotaxa_project_id || !project.ecotaxa_instance_id) return;

        const ecotaxa_instance = await this.ecotaxaAccountRepository.getOneEcoTaxaInstance(project.ecotaxa_instance_id);
        if (!ecotaxa_instance) return;

        // Use the generic account for the ecotaxa instance
        let baseUrl: string;
        let token: string;
        try {
            const genericAccount = await this.ecotaxaAccountRepository.getEcotaxaGenericAccountForInstance(project.ecotaxa_instance_id);
            baseUrl = ecotaxa_instance.ecotaxa_instance_url;
            token = genericAccount.ecotaxa_account_token;
        } catch {
            // If no generic account found, skip ecotaxa cleanup
            return;
        }

        // Query EcoTaxa objects by sample name and delete them
        const objectIds = await this.ecotaxaAccountRepository.api_ecotaxa_query_objects_by_sample(baseUrl, token, project.ecotaxa_project_id, [sample.sample_name]);
        if (objectIds.length > 0) {
            await this.ecotaxaAccountRepository.api_ecotaxa_delete_objects(baseUrl, token, objectIds);
        }

        // Clear the ecotaxa fields on the sample in local DB
        await this.sampleRepository.deleteEcoTaxaSamplesFromDb([sample]);
    }
}