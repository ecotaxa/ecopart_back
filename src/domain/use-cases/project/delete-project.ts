import { ProjectRequestModel, ProjectResponseModel } from "../../entities/project";
import { PreparedSearchOptions } from "../../entities/search";
import { UserUpdateModel } from "../../entities/user";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { DeleteProjectUseCase } from "../../interfaces/use-cases/project/delete-project";

export class DeleteProject implements DeleteProjectUseCase {
    userRepository: UserRepository
    projectRepository: ProjectRepository
    privilegeRepository: PrivilegeRepository
    sampleRepository: SampleRepository
    ecotaxaAccountRepository: EcotaxaAccountRepository

    constructor(userRepository: UserRepository, projectRepository: ProjectRepository, privilegeRepository: PrivilegeRepository, sampleRepository: SampleRepository, ecotaxaAccountRepository: EcotaxaAccountRepository) {
        this.userRepository = userRepository
        this.projectRepository = projectRepository
        this.privilegeRepository = privilegeRepository
        this.sampleRepository = sampleRepository
        this.ecotaxaAccountRepository = ecotaxaAccountRepository
    }

    async execute(current_user: UserUpdateModel, project_to_delete: ProjectRequestModel): Promise<void> {
        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Ensure the project to delete exists
        const project = await this.ensureProjectExists(project_to_delete);

        // Ensure the current user has permission to delete the project
        await this.ensureUserCanDelete(current_user, project_to_delete);

        // Delete all samples belonging to the project (with EcoTaxa cleanup)
        await this.deleteProjectSamples(project);

        // Delete the EcoTaxa project if linked
        await this.deleteEcoTaxaProject(project);

        // Delete the project
        await this.deleteProject(project_to_delete);
    }

    // Ensure the project to delete exists and return it
    private async ensureProjectExists(project: ProjectRequestModel): Promise<ProjectResponseModel> {
        const found = await this.projectRepository.getProject(project);
        if (!found) {
            throw new Error("Cannot find project to delete");
        }
        return found;
    }

    // Ensure user is admin or has manager privilege to delete the project
    private async ensureUserCanDelete(current_user: UserUpdateModel, project: ProjectRequestModel): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isManager({
            user_id: current_user.user_id,
            project_id: project.project_id
        });

        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot delete this project");
        }
    }

    // Delete the project
    private async deleteProject(project: ProjectRequestModel): Promise<void> {
        const deletedProjectsCount = await this.projectRepository.deleteProject(project);
        if (deletedProjectsCount === 0) {
            throw new Error("Cannot delete project");
        }
    }

    // Delete all samples belonging to the project, cleaning up EcoTaxa objects for imported samples
    private async deleteProjectSamples(project: ProjectResponseModel): Promise<void> {
        const options: PreparedSearchOptions = {
            filter: [{ field: "project_id", operator: "=", value: project.project_id }],
            sort_by: [],
            page: 1,
            limit: 10000
        }
        const result = await this.sampleRepository.standardGetSamples(options);
        if (!result || result.total === 0) return;

        // Check if any samples have ecotaxa data to clean up
        const ecotaxaSamples = result.items.filter(s => s.ecotaxa_sample_imported);
        if (ecotaxaSamples.length > 0 && project.ecotaxa_project_id && project.ecotaxa_instance_id) {
            try {
                const ecotaxa_instance = await this.ecotaxaAccountRepository.getOneEcoTaxaInstance(project.ecotaxa_instance_id);
                if (ecotaxa_instance) {
                    const genericAccount = await this.ecotaxaAccountRepository.getEcotaxaGenericAccountForInstance(project.ecotaxa_instance_id);
                    const baseUrl = ecotaxa_instance.ecotaxa_instance_url;
                    const token = genericAccount.ecotaxa_account_token;
                    const sampleNames = ecotaxaSamples.map(s => s.sample_name);

                    const objectIds = await this.ecotaxaAccountRepository.api_ecotaxa_query_objects_by_sample(baseUrl, token, project.ecotaxa_project_id, sampleNames);
                    if (objectIds.length > 0) {
                        await this.ecotaxaAccountRepository.api_ecotaxa_delete_objects(baseUrl, token, objectIds);
                    }
                }
            } catch {
                // If EcoTaxa cleanup fails, continue with local deletion
            }

            // Clear ecotaxa fields on samples in local DB
            await this.sampleRepository.deleteEcoTaxaSamplesFromDb(ecotaxaSamples);
        }

        // Delete all samples from DB and storage
        for (const sample of result.items) {
            await this.sampleRepository.deleteSample({ sample_id: sample.sample_id });
            await this.sampleRepository.deleteSampleFromStorage(sample.sample_name, project.project_id);
        }
    }

    // Delete the EcoTaxa project if one is linked
    private async deleteEcoTaxaProject(project: ProjectResponseModel): Promise<void> {
        if (!project.ecotaxa_project_id || !project.ecotaxa_instance_id) return;

        try {
            const ecotaxa_instance = await this.ecotaxaAccountRepository.getOneEcoTaxaInstance(project.ecotaxa_instance_id);
            if (!ecotaxa_instance) return;

            const genericAccount = await this.ecotaxaAccountRepository.getEcotaxaGenericAccountForInstance(project.ecotaxa_instance_id);
            const baseUrl = ecotaxa_instance.ecotaxa_instance_url;
            const token = genericAccount.ecotaxa_account_token;

            await this.ecotaxaAccountRepository.api_delete_ecotaxa_project(baseUrl, token, project.ecotaxa_project_id);
        } catch {
            // If EcoTaxa project deletion fails, continue with local deletion
        }
    }
}