import { ProjectRequestModel, PublicProjectResponseModel } from "../../entities/project";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { GetProjectUseCase } from "../../interfaces/use-cases/project/get-project";

export class GetProject implements GetProjectUseCase {
    userRepository: UserRepository
    projectRepository: ProjectRepository
    privilegeRepository: PrivilegeRepository

    constructor(userRepository: UserRepository, projectRepository: ProjectRepository, privilegeRepository: PrivilegeRepository) {
        this.userRepository = userRepository
        this.projectRepository = projectRepository
        this.privilegeRepository = privilegeRepository
    }

    async execute(current_user: UserUpdateModel, project_to_get: ProjectRequestModel): Promise<PublicProjectResponseModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        const project = await this.projectRepository.getProject(project_to_get);
        if (!project) throw new Error("Cannot find project");

        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userIsGranted = await this.privilegeRepository.isGranted({
            user_id: current_user.user_id,
            project_id: project.project_id
        });
        if (!userIsAdmin && !userIsGranted) {
            throw new Error("Logged user cannot get this project");
        }

        const privileges = await this.privilegeRepository.getPublicPrivileges({ project_id: project.project_id });
        if (!privileges) throw new Error("Cannot find privileges");

        return this.projectRepository.toPublicProject(project, privileges);
    }
}
