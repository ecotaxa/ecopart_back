import { ProjectRequestModel } from "../../entities/project";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { DeleteProjectUseCase } from "../../interfaces/use-cases/project/delete-project";

export class DeleteProject implements DeleteProjectUseCase {
    userRepository: UserRepository
    projectRepository: ProjectRepository
    privilegeRepository: PrivilegeRepository

    constructor(userRepository: UserRepository, projectRepository: ProjectRepository, privilegeRepository: PrivilegeRepository) {
        this.userRepository = userRepository
        this.projectRepository = projectRepository
        this.privilegeRepository = privilegeRepository
    }

    async execute(current_user: UserUpdateModel, project_to_delete: ProjectRequestModel): Promise<void> {
        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Ensure the project to delete exists
        await this.ensureProjectExists(project_to_delete);

        // Ensure the current user has permission to delete the project
        await this.ensureUserCanDelete(current_user, project_to_delete);

        // Delete the project
        await this.deleteProject(project_to_delete);
    }

    // Ensure the project to delete exists
    private async ensureProjectExists(project: ProjectRequestModel): Promise<void> {
        await this.projectRepository.getProject(project).then(project => {
            if (!project) {
                throw new Error("Cannot find project to delete");
            }
        })
    }

    // Ensure user is admin or has privilege to delete the project
    private async ensureUserCanDelete(current_user: UserUpdateModel, project: ProjectRequestModel): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isGranted({
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
}