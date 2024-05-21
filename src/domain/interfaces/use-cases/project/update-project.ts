import { PublicProjectUpdateModel, PublicProjectResponseModel } from "../../../entities/project";
import { UserUpdateModel } from "../../../entities/user";
export interface UpdateProjectUseCase {
    execute(current_user: UserUpdateModel, project_to_update: PublicProjectUpdateModel): Promise<PublicProjectResponseModel>;
}
