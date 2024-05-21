import { ProjectRequestCreationtModel, PublicProjectRequestCreationtModel, PublicProjectResponseModel } from "../../entities/project";
import { UserUpdateModel } from "../../entities/user";
import { InstrumentModelRepository } from "../../interfaces/repositories/instrument_model-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { CreateProjectUseCase } from "../../interfaces/use-cases/project/create-project";

export class CreateProject implements CreateProjectUseCase {
    userRepository: UserRepository
    projectRepository: ProjectRepository
    instrumentRepository: InstrumentModelRepository

    constructor(userRepository: UserRepository, projectRepository: ProjectRepository, instrumentRepository: InstrumentModelRepository) {
        this.userRepository = userRepository
        this.projectRepository = projectRepository
        this.instrumentRepository = instrumentRepository
    }

    async execute(current_user: UserUpdateModel, public_project: PublicProjectRequestCreationtModel): Promise<PublicProjectResponseModel> {
        // check if current_user is deleted
        if (await this.userRepository.isDeleted(current_user.user_id)) throw new Error("User is deleted");


        if (public_project.override_depth_offset === undefined) {
            public_project.override_depth_offset = this.projectRepository.computeDefaultDepthOffset(public_project.instrument_model)
        }

        //get instrument id from name
        const instrument = await this.instrumentRepository.getOneInstrumentModel({ instrument_model_name: public_project.instrument_model });
        if (!instrument) { throw new Error("Instrument not found"); }

        // Create the project with the provided information
        const project: ProjectRequestCreationtModel = {
            root_folder_path: public_project.root_folder_path,
            project_title: public_project.project_title,
            project_acronym: public_project.project_acronym,
            project_description: public_project.project_description,
            project_information: public_project.project_information,
            cruise: public_project.cruise,
            ship: public_project.ship,
            data_owner_name: public_project.data_owner_name,
            data_owner_email: public_project.data_owner_email,
            operator_name: public_project.operator_name,
            operator_email: public_project.operator_email,
            chief_scientist_name: public_project.chief_scientist_name,
            chief_scientist_email: public_project.chief_scientist_email,
            override_depth_offset: public_project.override_depth_offset,
            enable_descent_filter: public_project.enable_descent_filter,
            privacy_duration: public_project.privacy_duration,
            visible_duration: public_project.visible_duration,
            public_duration: public_project.public_duration,
            instrument_model: instrument.instrument_model_id,
            serial_number: public_project.serial_number
        };

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