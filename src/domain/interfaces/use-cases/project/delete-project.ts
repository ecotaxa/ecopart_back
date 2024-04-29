import { ProjectRequestModel } from "../../../entities/project";
import { UserUpdateModel } from "../../../entities/user";
export interface DeleteProjectUseCase {
    execute(current_user: UserUpdateModel, project_to_delete: ProjectRequestModel): Promise<void>;
}