import { ProjectRequestModel } from "../../entities/project";
import { UserUpdateModel } from "../../entities/user";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { DeleteProjectUseCase } from "../../interfaces/use-cases/project/delete-project";

export class DeleteProject implements DeleteProjectUseCase {
    userRepository: UserRepository
    projectRepository: ProjectRepository

    constructor(userRepository: UserRepository, projectRepository: ProjectRepository) {
        this.userRepository = userRepository
        this.projectRepository = projectRepository
    }

    async execute(current_user: UserUpdateModel, project_to_delete: ProjectRequestModel): Promise<void> {
        let nb_of_deleted_project: number = 0

        // check if current_user is deleted
        if (await this.userRepository.isDeleted(current_user.user_id)) throw new Error("User is deleted");

        // Check that project to delete exist
        const project_to_delete_exist = await this.projectRepository.getProject(project_to_delete)
        if (!project_to_delete_exist) throw new Error("Can't find project to delete");


        // Check that current_user is admin or is the user to update
        const user_is_allowed_to_delete = true //TODO in following sprint
        if (await this.userRepository.isAdmin(current_user.user_id) || user_is_allowed_to_delete) {
            nb_of_deleted_project = await this.projectRepository.deleteProject(project_to_delete)
            if (nb_of_deleted_project == 0) throw new Error("Can't delete project");
        } else {
            throw new Error("Logged user cannot delete this project");
        }

    }
}