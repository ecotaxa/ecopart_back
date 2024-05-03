import { ProjectUpdateModel, ProjectResponseModel } from "../../../entities/project";
import { UserUpdateModel } from "../../../entities/user";
export interface UpdateProjectUseCase {
    execute(current_user: UserUpdateModel, project_to_update: ProjectUpdateModel): Promise<ProjectResponseModel>;
}
