import { PublicEcotaxaAccountResponseModel } from "../../entities/ecotaxa_account";
import { UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { RefreshEcotaxaAccountUseCase } from "../../interfaces/use-cases/ecotaxa_account/refresh-ecotaxa_account";

/**
 * Renews the EcoTaxa session of an EcoTaxa account with its refresh token (EcoTaxa api/token/refresh), without
 * asking for the password again: the "Reconnect" button of an expired account. The session is also renewed on its
 * own whenever EcoTaxa refuses the access token of a call. Fails with "Ecotaxa account session expired" when
 * EcoTaxa refuses the refresh token, or the account has none (logged in with the former api/login): the user
 * must then log in to EcoTaxa again. Same rights as logging out of the account: its owner or an admin.
 */
export class RefreshEcotaxaAccount implements RefreshEcotaxaAccountUseCase {
    userRepository: UserRepository
    ecotaxaAccountRepository: EcotaxaAccountRepository

    constructor(userRepository: UserRepository, ecotaxaAccountRepository: EcotaxaAccountRepository) {
        this.userRepository = userRepository
        this.ecotaxaAccountRepository = ecotaxaAccountRepository
    }

    async execute(current_user: UserUpdateModel, ecopart_user_id: number, ecotaxa_account_id: number): Promise<PublicEcotaxaAccountResponseModel> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        const isAdmin = await this.userRepository.isAdmin(current_user.user_id);
        if (!isAdmin && current_user.user_id !== ecopart_user_id) {
            throw new Error("User cannot refresh this ecotaxa account");
        }

        const ecotaxa_account = await this.ecotaxaAccountRepository.getOneEcotaxaAccount(ecotaxa_account_id, ecopart_user_id);
        if (!ecotaxa_account) {
            throw new Error("Ecotaxa account not found");
        }

        const refreshed = await this.ecotaxaAccountRepository.refreshEcotaxaAccountSession(ecotaxa_account_id);
        return this.ecotaxaAccountRepository.formatEcotaxaAccountResponse(refreshed);
    }
}
