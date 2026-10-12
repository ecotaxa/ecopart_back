import { PublicTaskResponseModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";
export interface CancelTaskUseCase {
    execute(current_user: UserUpdateModel, task_id: number): Promise<PublicTaskResponseModel>;
}
