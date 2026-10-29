import { PublicTaskResponseModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";

// Starts the task that deletes the given samples of a project, and returns it.
export interface DeleteSampleUseCase {
    execute(current_user: UserUpdateModel, project_id: number, sample_ids: number[]): Promise<PublicTaskResponseModel>;
}
