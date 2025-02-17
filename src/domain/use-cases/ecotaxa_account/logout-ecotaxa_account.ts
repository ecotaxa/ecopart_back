
import { UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { LogoutEcotaxaAccountUseCase } from "../../interfaces/use-cases/ecotaxa_account/logout-ecotaxa_account";

export class LogoutEcotaxaAccount implements LogoutEcotaxaAccountUseCase {
    userRepository: UserRepository
    ecotaxaAccountRepository: EcotaxaAccountRepository

    constructor(userRepository: UserRepository, ecotaxaAccountRepository: EcotaxaAccountRepository) {
        this.userRepository = userRepository
        this.ecotaxaAccountRepository = ecotaxaAccountRepository
    }

    async execute(current_user: UserUpdateModel, ecopart_user_id: number, ecotaxa_account_to_delete_id: number): Promise<void> {
        // Check if current_user is deleted or invalid
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Ensure ecotaxa account to delete exists
        const ecotaxa_account = await this.ecotaxaAccountRepository.getOneEcotaxaAccount(ecotaxa_account_to_delete_id);
        if (!ecotaxa_account) {
            throw new Error("Ecotaxa account not found");
        }

        // Ensure account to delete belongs to a valid ecopart user
        await this.userRepository.ensureUserCanBeUsed(ecopart_user_id);

        // Ensure current user can delete account to the desired ecopart user
        await this.ensureUserCanDeleteAccount(current_user.user_id, ecopart_user_id);

        // Delete the ecotaxa account
        await this.ecotaxaAccountRepository.deleteEcotaxaAccount({
            ecotaxa_account_id: ecotaxa_account_to_delete_id,
            ecotaxa_account_ecopart_user_id: ecopart_user_id
        });
    }

    async ensureUserCanDeleteAccount(user_id: number, ecopart_user_id: number): Promise<void> {
        const isAdmin = await this.userRepository.isAdmin(user_id);
        const userCanAddAccount = isAdmin || user_id === ecopart_user_id;
        if (!userCanAddAccount) {
            throw new Error("User cannot logout from the requested ecotaxa account");
        }
    }
}
