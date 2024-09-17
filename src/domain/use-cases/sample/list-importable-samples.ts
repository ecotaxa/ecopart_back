import { PublicSampleResponseModel } from "../../entities/sample";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";

import { ListImportableSamplesUseCase } from "../../interfaces/use-cases/sample/list-importable-samples";
import { ProjectResponseModel } from "../../entities/project";

export class ListImportableSamples implements ListImportableSamplesUseCase {
    sampleRepository: SampleRepository
    userRepository: UserRepository
    privilegeRepository: PrivilegeRepository
    projectRepository: ProjectRepository

    constructor(sampleRepository: SampleRepository, userRepository: UserRepository, privilegeRepository: PrivilegeRepository, projectRepository: ProjectRepository) {
        this.sampleRepository = sampleRepository
        this.userRepository = userRepository
        this.privilegeRepository = privilegeRepository
        this.projectRepository = projectRepository
    }

    async execute(current_user: UserUpdateModel, project_id: number): Promise<PublicSampleResponseModel[]> {
        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Ensure the current user has permission to get the project importable samples
        await this.ensureUserCanGet(current_user, project_id);

        const project: ProjectResponseModel = await this.getProjectIfExist(project_id);

        const samples = await this.listImportableSamples(project);

        // Ensure the task to get exists
        if (!samples) { throw new Error("Cannot find samples"); }

        return samples;
    }

    private async listImportableSamples(project: ProjectResponseModel): Promise<PublicSampleResponseModel[]> {
        await this.sampleRepository.ensureFolderExists(project.root_folder_path);
        const samples = await this.sampleRepository.listImportableSamples(project.root_folder_path);
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
        console.log("project_id : ", project_id);
        console.log("current_user.user_id : ", current_user.user_id);
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        console.log("userIsAdmin : ", userIsAdmin);
        const userHasPrivilege = await this.privilegeRepository.isGranted({
            user_id: current_user.user_id,
            project_id: project_id
        });
        console.log("userHasPrivilege : ", userHasPrivilege);

        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot list importable samples in this project");
        }
    }
}