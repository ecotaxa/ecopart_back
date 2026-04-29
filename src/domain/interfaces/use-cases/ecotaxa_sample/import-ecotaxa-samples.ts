import { TaskResponseModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";

export interface ImportEcoTaxaSamplesUseCase {
    execute(current_user: UserUpdateModel, project_id: number, samples_names: string[]): Promise<TaskResponseModel>;
}