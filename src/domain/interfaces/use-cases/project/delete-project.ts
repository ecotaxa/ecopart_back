import { ProjectRequestModel } from "../../../entities/project";
import { PublicTaskResponseModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";

// Starts the task that deletes a project with everything it holds, and returns it.
export interface DeleteProjectUseCase {
    execute(current_user: UserUpdateModel, project_to_delete: ProjectRequestModel): Promise<PublicTaskResponseModel>;
}
