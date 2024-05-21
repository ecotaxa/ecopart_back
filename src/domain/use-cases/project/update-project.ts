import { UserUpdateModel } from "../../entities/user";
import { ProjectUpdateModel, PublicProjectResponseModel, PublicProjectUpdateModel } from "../../entities/project";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { UpdateProjectUseCase } from "../../interfaces/use-cases/project/update-project";
import { InstrumentModelRepository } from "../../interfaces/repositories/instrument_model-repository";

export class UpdateProject implements UpdateProjectUseCase {
    userRepository: UserRepository
    projectRepository: ProjectRepository
    instrument_modelRepository: InstrumentModelRepository

    constructor(userRepository: UserRepository, projectRepository: ProjectRepository, instrument_modelRepository: InstrumentModelRepository) {
        this.userRepository = userRepository
        this.projectRepository = projectRepository
        this.instrument_modelRepository = instrument_modelRepository
    }

    async execute(current_user: UserUpdateModel, public_project_to_update: PublicProjectUpdateModel): Promise<PublicProjectResponseModel> {
        let nb_of_updated_project: number = 0

        const project_to_update: PublicProjectUpdateModel | ProjectUpdateModel = public_project_to_update

        // User should not be deleted
        if (await this.userRepository.isDeleted(current_user.user_id)) throw new Error("User is deleted");

        //if want to update instrument
        if (project_to_update.instrument_model) {
            const instrument = await this.instrument_modelRepository.getOneInstrumentModel({ instrument_model_name: project_to_update.instrument_model });
            if (!instrument) { throw new Error("Instrument not found"); }
            (project_to_update as ProjectUpdateModel).instrument_model = instrument.instrument_model_id
        }



        // update admin can update any project // TODO LATER fix some contitions for non admin like priviledge on project
        if (await this.userRepository.isAdmin(current_user.user_id) || current_user.user_id) {
            nb_of_updated_project = await this.projectRepository.standardUpdateProject(project_to_update as ProjectUpdateModel)
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