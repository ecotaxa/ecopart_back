import { MinimalUserModel, UserUpdateModel } from "../../entities/user";
import { ProjectResponseModel, ProjectUpdateModel, PublicProjectResponseModel, PublicProjectUpdateModel } from "../../entities/project";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { UpdateProjectUseCase } from "../../interfaces/use-cases/project/update-project";
import { InstrumentModelRepository } from "../../interfaces/repositories/instrument_model-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { PrivilegeRequestModel, PublicPrivilege } from "../../entities/privilege";

export class UpdateProject implements UpdateProjectUseCase {
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

    async execute(current_user: UserUpdateModel, public_project_to_update: PublicProjectUpdateModel): Promise<PublicProjectResponseModel> {
        // Check if current_user is deleted or invalid
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        // Ensure the project to delete exists
        await this.ensureProjectExists(public_project_to_update);
        // Ensure user has the privilege to update the project
        await this.ensureUserCanUpdate(current_user, public_project_to_update);
        // Prepare the project update model
        const project_to_update: ProjectUpdateModel = await this.prepareProjectUpdateModel(public_project_to_update);
        // Update the project
        await this.updateProject(project_to_update, public_project_to_update);
        // Retrieve updated project
        const updated_project = await this.getUpdatedProject(project_to_update.project_id);
        // Retrieve updated privileges
        const updated_privileges = await this.getUpdatedPrivileges(project_to_update.project_id);
        // Return the updated project with privileges
        return this.projectRepository.toPublicProject(updated_project, updated_privileges);
    }

    // Ensure the project to update exists
    private async ensureProjectExists(project: PublicProjectUpdateModel): Promise<void> {
        const projectExists = await this.projectRepository.getProject({ project_id: project.project_id });
        if (!projectExists) {
            throw new Error("Cannot find project to update");
        }
    }

    // Ensure user is admin or has privilege to update the project
    private async ensureUserCanUpdate(current_user: UserUpdateModel, project: PublicProjectUpdateModel): Promise<void> {
        const is_granted_params: PrivilegeRequestModel = { user_id: current_user.user_id, project_id: project.project_id }
        const hasPrivilege = await this.privilegeRepository.isGranted(is_granted_params) || await this.userRepository.isAdmin(current_user.user_id);
        if (!hasPrivilege) {
            throw new Error("Logged user cannot update this property or project");
        }
        // Only managers or admin can update privileges of a project
        if (this.isPrivilegeUpdate(project)) {
            const canUpdatePrivilege = await this.privilegeRepository.isManager(is_granted_params) || await this.userRepository.isAdmin(current_user.user_id);
            if (!canUpdatePrivilege) {
                throw new Error("Logged user cannot update privileges");
            }
        }
    }

    private async prepareProjectUpdateModel(public_project_to_update: PublicProjectUpdateModel): Promise<ProjectUpdateModel> {
        // Add only the properties that are defined
        const project_to_update: ProjectUpdateModel = { project_id: public_project_to_update.project_id };

        for (const key in public_project_to_update) {
            if (public_project_to_update[key] !== undefined) {
                // If updating instrument model
                if (key === "instrument_model") {
                    const instrument = await this.instrument_modelRepository.getInstrumentByName(public_project_to_update.instrument_model as string);
                    project_to_update[key] = instrument.instrument_model_id;
                    // Else if not in members, managers and contact add it to project_to_update
                } else if (key !== "members" && key !== "managers" && key !== "contact") {
                    project_to_update[key] = public_project_to_update[key];
                }
            }
        }
        return project_to_update;
    }

    private async updateProject(project: ProjectUpdateModel, public_project_to_update: PublicProjectUpdateModel): Promise<void> {

        let privilegeUpdated: boolean = false
        // Validate and update privileges if provided
        if (this.isPrivilegeUpdate(public_project_to_update)) {
            const privilege: PublicPrivilege = {
                project_id: public_project_to_update.project_id,
                members: public_project_to_update.members as MinimalUserModel[],
                managers: public_project_to_update.managers as MinimalUserModel[],
                contact: public_project_to_update.contact as MinimalUserModel
            }
            await this.validateAndUpdatePrivileges(privilege);
            privilegeUpdated = true;
        } else {
            // Ensure privileges are not partially filled
            this.ensurePrivilegesAreNotPartiallyFilled(public_project_to_update);
        }

        // Update the project
        await this.updateProjectProperties(project, privilegeUpdated);
    }

    private ensurePrivilegesAreNotPartiallyFilled(public_project_to_update: PublicProjectUpdateModel): void {
        if (public_project_to_update.members || public_project_to_update.managers || public_project_to_update.contact) {
            throw new Error("To update privilege part you must provide members, managers and contact, if you want to manage privileges more granuraly please use privilege endpoints")
        }
    }

    private isPrivilegeUpdate(public_project_to_update: PublicProjectUpdateModel): boolean {
        return public_project_to_update.members !== undefined &&
            public_project_to_update.managers !== undefined &&
            public_project_to_update.contact !== undefined;
    }

    private async validateAndUpdatePrivileges(privilege: PublicPrivilege): Promise<void> {

        // Validate users privileges
        await this.validateUsersPrivileges(privilege);

        // Delete all existing privileges
        await this.privilegeRepository.deletePrivileges({ project_id: privilege.project_id });

        // Create new privileges
        const number_of_created_privileges = await this.privilegeRepository.createPrivileges(privilege);

        // Ensure privileges were updated correctly
        if (number_of_created_privileges !== privilege.members.length + privilege.managers.length) {
            throw new Error("Privileges partially updated, please check members, managers and contact. Other project properties were not updated due to this error, please try again.");
        }
    }

    private async validateUsersPrivileges(privilege: PublicPrivilege): Promise<void> {
        // Validate contact user
        await this.userRepository.ensureTypedUserCanBeUsed(privilege.contact.user_id, "Contact user");

        // Validate member users
        await Promise.all(privilege.members.map(async member => {
            await this.userRepository.ensureTypedUserCanBeUsed(member.user_id, "Member user");
        }));

        // Validate manager users
        await Promise.all(privilege.managers.map(async manager => {
            await this.userRepository.ensureTypedUserCanBeUsed(manager.user_id, "Manager user");
        }));

        // Ensure privilege coherence
        this.privilegeRepository.ensurePrivilegeCoherence(privilege);
    }

    private async updateProjectProperties(project_to_update: ProjectUpdateModel, privilegeUpdated: boolean): Promise<void> {
        try {
            const updated_count = await this.projectRepository.standardUpdateProject(project_to_update);
            // TODO not sure about this
            if (updated_count === 0) {
                throw new Error("Cannot update project");
            }
        } catch (e) {
            if (e.message === "Please provide at least one property to update" && !privilegeUpdated) {
                throw new Error("Please provide at least one property to update");
            }
            throw e;
        }
    }

    private async getUpdatedProject(project_id: number): Promise<ProjectResponseModel> {
        const updated_project = await this.projectRepository.getProject({ project_id: project_id });
        if (!updated_project) {
            throw new Error("Cannot find updated project");
        }
        return updated_project;
    }

    private async getUpdatedPrivileges(project_id: number): Promise<PublicPrivilege> {
        const privileges = await this.privilegeRepository.getPublicPrivileges({ project_id: project_id });
        if (!privileges) {
            throw new Error("Cannot find privileges");
        }
        return privileges;
    }

}
