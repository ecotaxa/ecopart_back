import { TaskResponseModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";
export interface GetOneTaskUseCase {
    execute(current_user: UserUpdateModel, task_id: number): Promise<TaskResponseModel>;
}