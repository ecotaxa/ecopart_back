import { UserUpdateModel } from "../../../entities/user";
export interface GetLogFileTaskUseCase {
    execute(current_user: UserUpdateModel, task_id: number): Promise<string>;
}