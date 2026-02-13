import { PublicImportableEcoTaxaSampleResponseModel } from "../../entities/sample";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";

import { ListImportableEcoTaxaSamplesUseCase } from "../../interfaces/use-cases/ecotaxa_sample/list-importable-ecotaxa-samples";
import { ProjectResponseModel } from "../../entities/project";
import path from "path";

export class ListImportableEcoTaxaSamples implements ListImportableEcoTaxaSamplesUseCase {
    sampleRepository: SampleRepository
    userRepository: UserRepository
    privilegeRepository: PrivilegeRepository
    projectRepository: ProjectRepository
    DATA_STORAGE_FS_STORAGE: string

    constructor(sampleRepository: SampleRepository, userRepository: UserRepository, privilegeRepository: PrivilegeRepository, projectRepository: ProjectRepository, DATA_STORAGE_FS_STORAGE: string) {
        this.sampleRepository = sampleRepository
        this.userRepository = userRepository
        this.privilegeRepository = privilegeRepository
        this.projectRepository = projectRepository
        this.DATA_STORAGE_FS_STORAGE = DATA_STORAGE_FS_STORAGE
    }

    async execute(current_user: UserUpdateModel, project_id: number): Promise<PublicImportableEcoTaxaSampleResponseModel[]> {
        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Ensure the current user has permission to get the project importable ecotaxa samples
        await this.ensureUserCanGet(current_user, project_id);

        const project: ProjectResponseModel = await this.getProjectIfExist(project_id);

        const ecotaxa_samples = await this.listImportableSamples(project);

        return ecotaxa_samples;
    }

    private async listImportableSamples(project: ProjectResponseModel): Promise<PublicImportableEcoTaxaSampleResponseModel[]> {
        const dest_folder = path.join(this.DATA_STORAGE_FS_STORAGE, `${project.project_id}`);
        await this.sampleRepository.ensureFolderExists(project.root_folder_path);
        const samples = await this.sampleRepository.listImportableEcoTaxaSamples(project.instrument_model, dest_folder, project.project_id);
        return samples;
    }

    private async getProjectIfExist(project_id: number): Promise<ProjectResponseModel> {
        const project = await this.projectRepository.getProject({ project_id: project_id });
        if (!project) {
            throw new Error("Cannot find project");
        }
        return project;
    }

    private async ensureUserCanGet(current_user: UserUpdateModel, project_id: number): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isGranted({
            user_id: current_user.user_id,
            project_id: project_id
        });
        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot list importable ecotaxa samples in this project");
        }
    }
}