import { EcotaxaAccountRequestModel } from "../../../entities/ecotaxa_account";
import { TaskResponseModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";

export interface ImportEcoTaxaSamplesUseCase {
    execute(current_user: UserUpdateModel, project_id: number, samples_names: string[], ecotaxa_user: EcotaxaAccountRequestModel): Promise<TaskResponseModel>;
}