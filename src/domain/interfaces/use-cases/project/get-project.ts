import { ProjectRequestModel, PublicProjectResponseModel } from "../../../entities/project";
import { UserUpdateModel } from "../../../entities/user";

export interface GetProjectUseCase {
    execute(current_user: UserUpdateModel, project: ProjectRequestModel): Promise<PublicProjectResponseModel>;
}
