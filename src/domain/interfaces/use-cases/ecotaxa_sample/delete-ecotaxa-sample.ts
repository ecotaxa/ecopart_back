import { EcotaxaAccountRequestModel } from "../../../entities/ecotaxa_account";
import { UserUpdateModel } from "../../../entities/user";
export interface DeleteEcoTaxaSampleUseCase {
    execute(current_user: UserUpdateModel, samples_names_to_delete: string[], project_id: number, ecotaxa_account: EcotaxaAccountRequestModel): Promise<void>;
}