import { UserUpdateModel } from "../../entities/user";
import { ProjectResponseModel, ProjectUpdateModel } from "../../entities/project";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { UpdateProjectUseCase } from "../../interfaces/use-cases/project/update-project";

export class UpdateProject implements UpdateProjectUseCase {
    userRepository: UserRepository
    projectRepository: ProjectRepository

    constructor(userRepository: UserRepository, projectRepository: ProjectRepository) {
        this.userRepository = userRepository
        this.projectRepository = projectRepository
    }

    async execute(current_user: UserUpdateModel, project_to_update: ProjectUpdateModel): Promise<ProjectResponseModel> {
        let nb_of_updated_project: number = 0

        // User should not be deleted
        if (await this.userRepository.isDeleted(current_user.user_id)) throw new Error("User is deleted");

        // update admin can update any project // TODO LATER fix some contitions for non admin like priviledge on project
        if (await this.userRepository.isAdmin(current_user.user_id) || current_user.user_id) {
            nb_of_updated_project = await this.projectRepository.standardUpdateProject(project_to_update)
            if (nb_of_updated_project == 0) throw new Error("Can't update project");
        } else {
            throw new Error("Logged user cannot update this property or project");
        }

        const updated_project = await this.projectRepository.getProject({ project_id: project_to_update.project_id })
        if (!updated_project) throw new Error("Can't find updated project");

        // private and public project same for now // TODO LATER 
        // const publicUser = this.userRepository.toPublicUser(updated_user)
        return updated_project
    }
}