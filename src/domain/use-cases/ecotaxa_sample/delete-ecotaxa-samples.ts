import { ProjectResponseModel } from "../../entities/project";
import { PublicSampleModel } from "../../entities/sample";
import { PreparedSearchOptions, SearchResult } from "../../entities/search";
import { UserUpdateModel } from "../../entities/user";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { DeleteEcoTaxaSamplesUseCase } from "../../interfaces/use-cases/ecotaxa_sample/delete-ecotaxa-samples";

export class DeleteEcoTaxaSamples implements DeleteEcoTaxaSamplesUseCase {
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

    async execute(current_user: UserUpdateModel, project_id: number, samples_names_to_delete: string[]): Promise<void> {

        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // get and ensure all of the samples to delete exist and have an associated ecotaxa sample, also ensure they all belong to the same project if a project_id is specified
        const samples_to_delete: PublicSampleModel[] = await this.ensureSamplesExists(samples_names_to_delete, project_id);


        // Ensure the current user has permission to delete the sample
        await this.ensureUserCanDelete(current_user, project_id);

        // Get project
        const project = await this.projectRepository.getProject({ project_id: project_id });
        if (!project) {
            throw new Error("Project not found");
        }

        // Delete the sample
        await this.deleteEcoTaxaSamples(samples_to_delete, project);

    }

    // Ensure the sample to delete exists and have an associated ecotaxa sample 
    private async ensureSamplesExists(sample_names: string[], project_id: number): Promise<PublicSampleModel[]> {

        const option: PreparedSearchOptions = {
            filter: [
                {
                    field: "sample_name",
                    operator: "IN",
                    value: sample_names
                },
                {
                    field: "project_id",
                    operator: "=",
                    value: project_id
                }
            ],
            sort_by: [],
            page: 1,
            limit: sample_names.length // we want to get all the samples in one query, so we set the limit to the number of sample names to delete

        }

        const result: SearchResult<PublicSampleModel> = await this.sampleRepository.standardGetSamples(option);

        if (result === null || result.total === 0) {
            throw new Error("Cannot find sample to delete");
        }
        // if a sample compare samples names is not found return error
        const foundSampleNames = result.items.map(sample => sample.sample_name);
        const missingSampleNames = sample_names.filter(name => !foundSampleNames.includes(name));
        if (missingSampleNames.length > 0) {
            throw new Error(`Some samples to delete were not found: ${missingSampleNames.join(", ")}`);
        }
        //ecotaxa_sample_imported should be at true for every samples
        if (result.items.some(sample => !sample.ecotaxa_sample_imported)) {
            throw new Error("The sample to delete does not have an associated EcoTaxa sample");
        }

        return result.items;
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

    // Delete samples from EcoTaxa and from the local database
    private async deleteEcoTaxaSamples(samples: PublicSampleModel[], project: ProjectResponseModel): Promise<void> {
        const ecotaxa_instance_id = project.ecotaxa_instance_id as number;
        const ecotaxa_project_id = project.ecotaxa_project_id as number;

        if (!ecotaxa_project_id) throw new Error("No linked EcoTaxa project");

        // Resolve instance
        const ecotaxa_instance = await this.ecotaxa_accountRepository.getOneEcoTaxaInstance(ecotaxa_instance_id);
        if (!ecotaxa_instance) throw new Error("Ecotaxa instance not found");

        // Use the generic account for the ecotaxa instance
        const genericAccount = await this.ecotaxa_accountRepository.getEcotaxaGenericAccountForInstance(ecotaxa_instance_id);

        const baseUrl = ecotaxa_instance.ecotaxa_instance_url;
        const token = genericAccount.ecotaxa_account_token;
        const samples_names_to_delete = samples.map(sample => sample.sample_name);
        // Query EcoTaxa objects by samples name
        const objectIds = await this.ecotaxa_accountRepository.api_ecotaxa_query_objects_by_sample(baseUrl, token, ecotaxa_project_id, samples_names_to_delete);

        // Delete matched objects from EcoTaxa
        await this.ecotaxa_accountRepository.api_ecotaxa_delete_objects(baseUrl, token, objectIds);

        // Delete sample from local database
        await this.sampleRepository.deleteEcoTaxaSamplesFromDb(samples);
    }
}