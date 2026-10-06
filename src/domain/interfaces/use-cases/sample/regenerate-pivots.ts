import { RegeneratePivotsOptions } from "../../../entities/pivot";
import { TaskResponseModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";

export interface RegeneratePivotsUseCase {
    execute(current_user: UserUpdateModel, project_id: number, options: RegeneratePivotsOptions): Promise<TaskResponseModel>;
}
