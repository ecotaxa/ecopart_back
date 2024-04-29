import { ProjectRequestCreationtModel, ProjectResponseModel } from "../../entities/project";
import { UserUpdateModel } from "../../entities/user";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { CreateProjectUseCase } from "../../interfaces/use-cases/project/create-project";

export class CreateProject implements CreateProjectUseCase {
    userRepository: UserRepository
    projectRepository: ProjectRepository

    constructor(userRepository: UserRepository, projectRepository: ProjectRepository) {
        this.userRepository = userRepository
        this.projectRepository = projectRepository
    }

    async execute(current_user: UserUpdateModel, project: ProjectRequestCreationtModel): Promise<ProjectResponseModel> {
        // check if current_user is deleted
        if (await this.userRepository.isDeleted(current_user.user_id)) throw new Error("User is deleted");

        if (project.override_depth_offset === undefined) {
            project.override_depth_offset = this.projectRepository.computeDefaultDepthOffset(project.instrument)
        }
        const createdId = await this.projectRepository.createProject(project);


        // Retrieve the newly created project information
        const createdProject = await this.projectRepository.getProject({ project_id: createdId });
        if (!createdProject) { throw new Error("Can't find created project"); }

        return createdProject;

        // Remove sensitive information before sending it : not needed for now
        // const publicProject = this.projectRepository.toPublicProject(createdUser)
        // return publicProject;
    }
}