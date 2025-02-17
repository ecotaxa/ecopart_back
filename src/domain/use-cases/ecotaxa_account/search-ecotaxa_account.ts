import { UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { SearchRepository } from "../../interfaces/repositories/search-repository";
import { SearchEcotaxaAccountsUseCase } from "../../interfaces/use-cases/ecotaxa_account/search-ecotaxa_account";
import { EcotaxaAccountResponseModel, PublicEcotaxaAccountResponseModel } from "../../entities/ecotaxa_account";
import { SearchOptions, SearchInfo, PreparedSearchOptions } from "../../entities/search";

export class SearchEcotaxaAccounts implements SearchEcotaxaAccountsUseCase {
    userRepository: UserRepository
    ecotaxaAccountRepository: EcotaxaAccountRepository
    searchRepository: SearchRepository

    constructor(userRepository: UserRepository, ecotaxaAccountRepository: EcotaxaAccountRepository, searchRepository: SearchRepository) {
        this.userRepository = userRepository
        this.ecotaxaAccountRepository = ecotaxaAccountRepository
        this.searchRepository = searchRepository

    }

    async execute(current_user: UserUpdateModel, user_id: number, options: SearchOptions): Promise<{ ecotaxa_accounts: PublicEcotaxaAccountResponseModel[], search_info: SearchInfo }> {
        // Check if current_user is deleted or invalid
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Ensure account to search belongs to a valid ecopart user
        await this.userRepository.ensureUserCanBeUsed(user_id);

        // Ensure current user can search account to the desired ecopart user
        await this.ensureUserCanSearchAccount(current_user.user_id, user_id);

        // Set filters to only get the ecotaxa accounts of the desired user
        options.filter = [{ field: "ecotaxa_account_ecopart_user_id", operator: "=", value: user_id }];

        // Check that options.sort_by are asked and format them if they are
        if (options.sort_by) {
            options.sort_by = this.searchRepository.formatSortBy(options.sort_by as string);
        }
        else {
            //default sort by expiration date
            options.sort_by = "asc(ecotaxa_account_expiration_date)"
            options.sort_by = this.searchRepository.formatSortBy(options.sort_by as string);

        }

        // Fetch the ecotaxa accounts from the repository using the prepared search options
        const result = await this.ecotaxaAccountRepository.standardGetEcotaxaAccountsModels(options as PreparedSearchOptions);
        const ecotaxa_accounts = result.items;
        //format the ecotaxa accounts to PublicEcotaxaAccountResponseModel
        const formatted_ecotaxa_accounts: PublicEcotaxaAccountResponseModel[] = ecotaxa_accounts.map((ecotaxa_account: EcotaxaAccountResponseModel) => {
            return this.ecotaxaAccountRepository.formatEcotaxaAccountResponse(ecotaxa_account);
        })
        // Format the search information using the search repository
        const search_info: SearchInfo = this.searchRepository.formatSearchInfo(result, options);

        return { search_info, ecotaxa_accounts: formatted_ecotaxa_accounts };

    }

    async ensureUserCanSearchAccount(user_id: number, ecopart_user_id: number): Promise<void> {
        const isAdmin = await this.userRepository.isAdmin(user_id);
        const userCanAddAccount = isAdmin || user_id === ecopart_user_id;
        if (!userCanAddAccount) {
            throw new Error("User cannot get requested ecotaxa accounts");
        }
    }
}
