import { UserUpdateModel } from "../../../entities/user";
export interface GetLogFileTaskUseCase {
    // from: byte offset of the log, to only get the lines written since (see TaskRepository.getLogFileTask)
    execute(current_user: UserUpdateModel, task_id: number, from?: number): Promise<string>;
}