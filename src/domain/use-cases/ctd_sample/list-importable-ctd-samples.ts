import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";

import { ListImportableCTDSamplesUseCase } from "../../interfaces/use-cases/ctd_sample/list-importable-ctd-samples";
import { ProjectResponseModel } from "../../entities/project";

export class ListImportableCTDSamples implements ListImportableCTDSamplesUseCase {
    sampleRepository: SampleRepository;
    userRepository: UserRepository;
    privilegeRepository: PrivilegeRepository;
    projectRepository: ProjectRepository;

    constructor(sampleRepository: SampleRepository, userRepository: UserRepository, privilegeRepository: PrivilegeRepository, projectRepository: ProjectRepository) {
        this.sampleRepository = sampleRepository;
        this.userRepository = userRepository;
        this.privilegeRepository = privilegeRepository;
        this.projectRepository = projectRepository;
    }

    async execute(current_user: UserUpdateModel, project_id: number): Promise<string[]> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        await this.ensureUserCanGet(current_user, project_id);

        const project: ProjectResponseModel = await this.getProjectIfExist(project_id);

        return this.sampleRepository.listImportableCTDSamples(project.root_folder_path, project.instrument_model, project.project_id);
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
            project_id: project_id,
        });

        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot list importable CTD samples in this project");
        }
    }
}
