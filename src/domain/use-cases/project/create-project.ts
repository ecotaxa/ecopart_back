import { ProjectRequestCreationModel, PublicProjectRequestCreationModel, PublicProjectResponseModel } from "../../entities/project";
import { UserUpdateModel } from "../../entities/user";
import { InstrumentModelRepository } from "../../interfaces/repositories/instrument_model-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { CreateProjectUseCase } from "../../interfaces/use-cases/project/create-project";

export class CreateProject implements CreateProjectUseCase {
    userRepository: UserRepository
    projectRepository: ProjectRepository
    instrument_modelRepository: InstrumentModelRepository
    privilegeRepository: PrivilegeRepository

    constructor(userRepository: UserRepository, projectRepository: ProjectRepository, instrument_modelRepository: InstrumentModelRepository, privilegeRepository: PrivilegeRepository) {
        this.userRepository = userRepository
        this.projectRepository = projectRepository
        this.instrument_modelRepository = instrument_modelRepository
        this.privilegeRepository = privilegeRepository
    }

    async execute(current_user: UserUpdateModel, public_project: PublicProjectRequestCreationModel): Promise<PublicProjectResponseModel> {
        // Check if current_user is deleted or invalid
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Set default depth offset if not provided
        this.setDefaultDepthOffset(public_project);

        // Get instrument id from name
        const instrument = await this.instrument_modelRepository.getInstrumentByName(public_project.instrument_model);

        // Validate project members, managers, and contact
        await this.validateUsersPrivileges(public_project);

        // Format the provided information
        const project: ProjectRequestCreationModel = this.projectRepository.formatProjectRequestCreationModel(public_project, instrument)
        // Create the project and retrieve its ID
        const createdProjectId = await this.projectRepository.createProject(project);

        // Retrieve the newly created project information
        const createdProject = await this.getCreatedProject(createdProjectId);

        // Create and retrieve privileges for the project
        const createdPrivileges = await this.createAndRetrievePrivileges(createdProjectId, public_project);

        // Return the newly created project with the privileges
        return this.projectRepository.toPublicProject(createdProject, createdPrivileges);
    }

    // Set default depth offset if not provided
    private setDefaultDepthOffset(publicProject: PublicProjectRequestCreationModel): void {
        if (publicProject.override_depth_offset === undefined) {
            publicProject.override_depth_offset = this.projectRepository.computeDefaultDepthOffset(publicProject.instrument_model);
        }
    }

    // Validate the project's users
    private async validateUsersPrivileges(publicProject: PublicProjectRequestCreationModel): Promise<void> {
        // Validate contact user
        await this.userRepository.ensureTypedUserCanBeUsed(publicProject.contact.user_id, "Contact user");

        // Validate member users
        await Promise.all(publicProject.members.map(async member => {
            await this.userRepository.ensureTypedUserCanBeUsed(member.user_id, "Member user");
        }));

        // Validate manager users
        await Promise.all(publicProject.managers.map(async manager => {
            await this.userRepository.ensureTypedUserCanBeUsed(manager.user_id, "Manager user");
        }));

        // Ensure privilege coherence
        this.privilegeRepository.ensurePrivilegeCoherence({
            project_id: 0,
            members: publicProject.members,
            managers: publicProject.managers,
            contact: publicProject.contact
        });
    }

    // Retrieve the created project
    private async getCreatedProject(projectId: number) {
        const project = await this.projectRepository.getProject({ project_id: projectId });
        if (!project) {
            throw new Error("Cannot find the created project.");
        }
        return project;
    }

    // Create and retrieve privileges for the project
    private async createAndRetrievePrivileges(projectId: number, publicProject: PublicProjectRequestCreationModel) {
        // Create the privileges for the project
        const createdPrivilegesIds: number = await this.privilegeRepository.createPrivileges({ project_id: projectId, members: publicProject.members, managers: publicProject.managers, contact: publicProject.contact })
        if (!createdPrivilegesIds) { throw new Error("Cannot create privileges for project"); }

        // Retrieve the newly created privileges
        const privileges = await this.privilegeRepository.getPublicPrivileges({ project_id: projectId });
        if (!privileges) { throw new Error("Cannot find created privileges"); }

        return privileges;
    }
}
