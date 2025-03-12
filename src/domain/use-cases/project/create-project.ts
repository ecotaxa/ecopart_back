import path from "path";
import { ProjectRequestCreationModel, PublicProjectRequestCreationModel, PublicProjectResponseModel } from "../../entities/project";
import { UserUpdateModel } from "../../entities/user";
import { InstrumentModelRepository } from "../../interfaces/repositories/instrument_model-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { CreateProjectUseCase } from "../../interfaces/use-cases/project/create-project";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";

export class CreateProject implements CreateProjectUseCase {
    userRepository: UserRepository
    projectRepository: ProjectRepository
    instrument_modelRepository: InstrumentModelRepository
    privilegeRepository: PrivilegeRepository
    ecotaxa_accountRepository: EcotaxaAccountRepository
    DATA_STORAGE_FS_STORAGE: string

    constructor(userRepository: UserRepository, projectRepository: ProjectRepository, instrument_modelRepository: InstrumentModelRepository, privilegeRepository: PrivilegeRepository, ecotaxa_accountRepository: EcotaxaAccountRepository, DATA_STORAGE_FS_STORAGE: string) {
        this.userRepository = userRepository
        this.projectRepository = projectRepository
        this.instrument_modelRepository = instrument_modelRepository
        this.privilegeRepository = privilegeRepository
        this.ecotaxa_accountRepository = ecotaxa_accountRepository
        this.DATA_STORAGE_FS_STORAGE = DATA_STORAGE_FS_STORAGE
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

        // Create or validate and retrieve the ecotaxa project and user ecotaxa_account_preferences
        const public_project_with_ecotaxa_proj_info = await this.handleEcotaxaProjectCreation(public_project, current_user);

        // Format the provided information
        const project: ProjectRequestCreationModel = this.projectRepository.formatProjectRequestCreationModel(public_project_with_ecotaxa_proj_info, instrument)
        // Create the project in the database and retrieve its ID
        const createdProjectId = await this.projectRepository.createProject(project);

        // Create the project root folder
        await this.createProjectRootFolder(createdProjectId);

        // Retrieve the newly created project information
        const createdProject = await this.getCreatedProject(createdProjectId);

        // Create and retrieve privileges for the project
        const createdPrivileges = await this.createAndRetrievePrivileges(createdProjectId, public_project);

        // Return the newly created project with the privileges
        return this.projectRepository.toPublicProject(createdProject, createdPrivileges);
    }
    async handleEcotaxaProjectCreation(public_project: PublicProjectRequestCreationModel, current_user: UserUpdateModel): Promise<PublicProjectRequestCreationModel> {
        if (!public_project.ecotaxa_account_id) return public_project
        await this.ensureUserCanUseEcotaxaAccount(current_user, public_project.ecotaxa_account_id);
        await this.ensureEcotaxaInstanceConsistency(public_project);
        if (public_project.new_ecotaxa_project) {
            // Create ecotaxa project with same title as ecopart project
            public_project.ecotaxa_project_id = await this.ecotaxa_accountRepository.createEcotaxaProject(public_project);
        } else if (public_project.ecotaxa_project_id) {
            // Link ecotaxa project
            public_project.ecotaxa_project_id = await this.ecotaxa_accountRepository.linkEcotaxaAndEcopartProject(public_project);
        }
        return public_project
    }
    async ensureEcotaxaInstanceConsistency(public_project: PublicProjectRequestCreationModel) {
        const { new_ecotaxa_project, ecotaxa_project_id, ecotaxa_instance_id, ecotaxa_account_id } = public_project;
        // If specified, ecotaxa instance should be valid
        if (ecotaxa_instance_id) {
            const ecotaxa_instance = await this.ecotaxa_accountRepository.getOneEcoTaxaInstance(ecotaxa_instance_id);
            if (!ecotaxa_instance) {
                throw new Error("Ecotaxa instance not found.");
            }
        }
        // If new ecotaxa project, ecotaxa instance should be provided
        if (new_ecotaxa_project && !ecotaxa_instance_id) {
            throw new Error("Ecotaxa instance ID is required for a new Ecotaxa project.");
        }
        // If existing ecotaxa project, ecotaxa instance should be provided
        if (!new_ecotaxa_project && ecotaxa_project_id && !ecotaxa_instance_id) {
            throw new Error("Ecotaxa instance ID is required for an existing Ecotaxa project.");
        }
        // If existing ecotaxa project, ecotaxa instance should match the ecotaxa account's instance
        if (!new_ecotaxa_project && ecotaxa_project_id) {
            const ecotaxa_account = await this.ecotaxa_accountRepository.getOneEcotaxaAccount(ecotaxa_account_id as number);
            if (!ecotaxa_account) {
                throw new Error("Ecotaxa account not found.");
            }
            if (ecotaxa_account.ecotaxa_account_instance_id !== ecotaxa_instance_id) {
                throw new Error("Mismatch: Ecotaxa instance ID does not match the Ecotaxa account's instance ID.");
            }
        }
    }

    // Set default depth offset if not provided
    private setDefaultDepthOffset(publicProject: PublicProjectRequestCreationModel): void {
        if (publicProject.override_depth_offset === undefined) {
            publicProject.override_depth_offset = this.projectRepository.computeDefaultDepthOffset(publicProject.instrument_model);
        }
    }
    async ensureUserCanUseEcotaxaAccount(current_user: UserUpdateModel, ecotaxa_account_id: number): Promise<void> {
        if (!await this.ecotaxa_accountRepository.ecotaxa_account_belongs(current_user.user_id, ecotaxa_account_id)) {
            throw new Error("User cannot use the provided ecotaxa account");
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
        const number_of_created_privileges: number = await this.privilegeRepository.createPrivileges({ project_id: projectId, members: publicProject.members, managers: publicProject.managers, contact: publicProject.contact })
        // Ensure privileges were created correctly
        if (number_of_created_privileges !== publicProject.members.length + publicProject.managers.length) {
            throw new Error("Privileges partially created, please check members, managers and contact");
        }
        // Retrieve the newly created privileges
        const privileges = await this.privilegeRepository.getPublicPrivileges({ project_id: projectId });
        if (!privileges || privileges.members.length + privileges.managers.length !== publicProject.members.length + publicProject.managers.length) {
            throw new Error("Cant find created privileges, please check members, managers and contact");
        }
        return privileges;
    }

    // Create the project root folder
    private async createProjectRootFolder(projectId: number) {
        const root_folder_path = path.join(this.DATA_STORAGE_FS_STORAGE, `${projectId}`);
        // create with fs
        await this.projectRepository.createProjectRootFolder(root_folder_path);

    }
}
