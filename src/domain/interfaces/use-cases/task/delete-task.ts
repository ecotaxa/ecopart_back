import { PublicTaskRequestModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";
export interface DeleteTaskUseCase {
    execute(current_user: UserUpdateModel, task_to_delete: PublicTaskRequestModel): Promise<void>;
}