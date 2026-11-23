import { PublicEcotaxaAccountResponseModel } from "../../../entities/ecotaxa_account";
import { UserUpdateModel } from "../../../entities/user";

export interface RefreshEcotaxaAccountUseCase {
    execute(current_user: UserUpdateModel, ecopart_user_id: number, ecotaxa_account_id: number): Promise<PublicEcotaxaAccountResponseModel>;
}
