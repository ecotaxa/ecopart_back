import { TaskResponseModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";

export interface ExportBackupedProjectUseCase {
    execute(current_user: UserUpdateModel, project_id: number, out_to_ftp: boolean): Promise<TaskResponseModel>;
}