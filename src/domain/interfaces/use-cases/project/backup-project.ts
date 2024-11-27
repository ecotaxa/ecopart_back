import { TaskResponseModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";

export interface BackupProjectUseCase {
    execute(current_user: UserUpdateModel, project_id: number, skip_already_imported: boolean): Promise<TaskResponseModel>;
}