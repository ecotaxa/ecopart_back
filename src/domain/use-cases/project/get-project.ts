import { ProjectRequestModel, PublicProjectResponseModel } from "../../entities/project";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { GetProjectUseCase } from "../../interfaces/use-cases/project/get-project";
import { ProjectAccessPolicy, restrictProjectView } from "./project-access";

export class GetProject implements GetProjectUseCase {
    userRepository: UserRepository
    projectRepository: ProjectRepository
    privilegeRepository: PrivilegeRepository
    private readonly access: ProjectAccessPolicy

    constructor(userRepository: UserRepository, projectRepository: ProjectRepository, privilegeRepository: PrivilegeRepository) {
        this.userRepository = userRepository
        this.projectRepository = projectRepository
        this.privilegeRepository = privilegeRepository
        this.access = new ProjectAccessPolicy(userRepository, privilegeRepository)
    }

    // Any logged-in user may see a project's metadata, whatever its privacy status, so that access
    // can be requested from its managers; what they see depends on their role on it.
    async execute(current_user: UserUpdateModel, project_to_get: ProjectRequestModel): Promise<PublicProjectResponseModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        const project = await this.projectRepository.getProject(project_to_get);
        if (!project) throw new Error("Cannot find project");

        const privileges = await this.privilegeRepository.getPublicPrivileges({ project_id: project.project_id });
        if (!privileges) throw new Error("Cannot find privileges");

        const role = await this.access.roleOf(current_user.user_id, project.project_id);
        return restrictProjectView(this.projectRepository.toPublicProject(project, privileges), role);
    }
}
