import { SearchInfo, SearchOptions } from "../../../entities/search";
import { PublicEcotaxaAccountResponseModel } from "../../../entities/ecotaxa_account";
import { UserUpdateModel } from "../../../entities/user";
export interface SearchEcotaxaAccountsUseCase {
    execute(current_user: UserUpdateModel, user_id: number, options: SearchOptions): Promise<{ ecotaxa_accounts: PublicEcotaxaAccountResponseModel[], search_info: SearchInfo }>;
}