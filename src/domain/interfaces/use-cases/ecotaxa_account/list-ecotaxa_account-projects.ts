import { PublicEcotaxaAccountProjectModel } from "../../../entities/ecotaxa_account";
import { UserUpdateModel } from "../../../entities/user";

export interface ListEcotaxaAccountProjectsUseCase {
    execute(current_user: UserUpdateModel, ecopart_user_id: number, ecotaxa_account_id: number, instrument_model?: string): Promise<PublicEcotaxaAccountProjectModel[]>;
}
