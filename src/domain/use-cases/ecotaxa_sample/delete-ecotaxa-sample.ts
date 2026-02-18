import { EcotaxaAccountRequestModel } from "../../entities/ecotaxa_account";
import { ProjectResponseModel } from "../../entities/project";
import { PublicSampleModel } from "../../entities/sample";
import { PreparedSearchOptions } from "../../entities/search";
import { UserUpdateModel } from "../../entities/user";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { DeleteEcoTaxaSampleUseCase } from "../../interfaces/use-cases/ecotaxa_sample/delete-ecotaxa-sample";

export class DeleteEcoTaxaSample implements DeleteEcoTaxaSampleUseCase {
    userRepository: UserRepository
    sampleRepository: SampleRepository
    privilegeRepository: PrivilegeRepository
    ecotaxa_accountRepository: EcotaxaAccountRepository
    projectRepository: ProjectRepository

    constructor(userRepository: UserRepository, sampleRepository: SampleRepository, privilegeRepository: PrivilegeRepository, ecotaxa_accountRepository: EcotaxaAccountRepository, projectRepository: ProjectRepository) {
        this.userRepository = userRepository
        this.sampleRepository = sampleRepository
        this.privilegeRepository = privilegeRepository
        this.ecotaxa_accountRepository = ecotaxa_accountRepository
        this.projectRepository = projectRepository
    }

    async execute(current_user: UserUpdateModel, samples_names_to_delete: string[], project_id: number, ecotaxa_account: EcotaxaAccountRequestModel): Promise<void> {

        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // ensure project exists
        const project = await this.projectRepository.getProject({ project_id: project_id });
        if (!project) {
            throw new Error("Project not found");
        }

        // Ensure the current user has permission to delete the sample
        await this.ensureUserCanDelete(current_user, project_id);

        // Ensure the samples to delete exist
        const samples = await this.ensureSamplesExist(samples_names_to_delete, project_id);

        // Delete the samples
        await this.deleteEcoTaxaSamples(samples, project, ecotaxa_account);
    }

    // Ensure the samples to delete exist and have an associated ecotaxa sample 
    private async ensureSamplesExist(samples_names: string[], project_id: number): Promise<PublicSampleModel[]> {
        const options: PreparedSearchOptions = {
            filter: [
                { field: "project_id", operator: "=", value: project_id },
                { field: "sample_name", operator: "IN", value: samples_names },
                { field: "ecotaxa_sample_imported", operator: "=", value: true }
            ],
            sort_by: [],
            page: 1,
            limit: samples_names.length
        }
        const result = await this.sampleRepository.standardGetSamples(options);
        if (result === null || result.items.length === 0) {
            throw new Error("Cannot find samples to delete");
        }
        return result.items as PublicSampleModel[];
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

    // Delete the sample from EcoTaxa and from the local database
    private async deleteEcoTaxaSamples(samples: PublicSampleModel[], project: ProjectResponseModel, ecotaxa_user: EcotaxaAccountRequestModel): Promise<void> {
        const ecotaxa_instance_id = project.ecotaxa_instance_id as number;
        const ecotaxa_project_id = project.ecotaxa_project_id as number;

        if (!ecotaxa_project_id) throw new Error("No linked EcoTaxa project");

        // Resolve account & instance
        const ecotaxa_instance = await this.ecotaxa_accountRepository.getOneEcoTaxaInstance(ecotaxa_instance_id);
        if (!ecotaxa_instance) throw new Error("Ecotaxa instance not found");

        const ecotaxa_account = await this.ecotaxa_accountRepository.getOneEcotaxaAccount(ecotaxa_user.ecotaxa_account_id);
        if (!ecotaxa_account) throw new Error("Ecotaxa account not found");

        const baseUrl = ecotaxa_instance.ecotaxa_instance_url;
        const token = ecotaxa_account.ecotaxa_account_token;

        // Query EcoTaxa objects by sample name
        const objectIds = await this.ecotaxa_accountRepository.api_ecotaxa_query_objects_by_samples(baseUrl, token, ecotaxa_project_id, samples.map(s => s.sample_name));
        if (objectIds.length === 0) {
            throw new Error("Cannot delete samples: no objects found in EcoTaxa");
        }

        // Delete matched objects from EcoTaxa
        await this.ecotaxa_accountRepository.api_ecotaxa_delete_objects(baseUrl, token, objectIds);

        // Delete sample from local database
        await this.sampleRepository.deleteEcoTaxaSamplesFromDb(samples.map(s => s.sample_name));
    }
}