import { ecotaxaAccountModel, EcotaxaAccountRequestCreationModel, PublicEcotaxaAccountRequestCreationModel } from "../../entities/ecotaxa_account";
import { UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { LoginEcotaxaAccountUseCase } from "../../interfaces/use-cases/ecotaxa_account/login-ecotaxa_account";

export class LoginEcotaxaAccount implements LoginEcotaxaAccountUseCase {
    userRepository: UserRepository
    ecotaxaAccountRepository: EcotaxaAccountRepository

    constructor(userRepository: UserRepository, ecotaxaAccountRepository: EcotaxaAccountRepository) {
        this.userRepository = userRepository
        this.ecotaxaAccountRepository = ecotaxaAccountRepository
    }

    async execute(current_user: UserUpdateModel, ecotaxa_account_to_create: PublicEcotaxaAccountRequestCreationModel): Promise<void> {
        // Check if current_user is deleted or invalid
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        await this.userRepository.ensureUserCanBeUsed(ecotaxa_account_to_create.ecopart_user_id);

        // Ensure ecotaxa instance exists
        const ecotaxa_instance = await this.ecotaxaAccountRepository.getOneEcoTaxaInstance(ecotaxa_account_to_create.ecotaxa_instance_id);
        if (!ecotaxa_instance) {
            throw new Error("Ecotaxa instance not found : " + ecotaxa_account_to_create.ecotaxa_instance_id);
        }
        // Ensure this accound does not already exist
        const account_already_exists = await this.ecotaxaAccountRepository.accountExists(ecotaxa_account_to_create);
        if (account_already_exists) {
            throw new Error("Account already exists");
        }

        // Ensure current user can add account to the desired ecopart user
        await this.ensureUserCanAddAccount(current_user.user_id, ecotaxa_account_to_create.ecopart_user_id);

        // Connect to the ecotaxa instance
        const ecotaxa_data = await this.ecotaxaAccountRepository.connectToEcotaxaInstance(ecotaxa_account_to_create);

        // format the ecotaxa_account_to_create with the token
        const private_ecotaxa_account_to_create = this.formatEcotaxaAccountToCreate(ecotaxa_account_to_create, ecotaxa_data);

        // Create the ecotaxa account
        await this.ecotaxaAccountRepository.createEcotaxaAccount(private_ecotaxa_account_to_create);
    }

    async ensureUserCanAddAccount(user_id: number, ecopart_user_id: number): Promise<void> {
        const isAdmin = await this.userRepository.isAdmin(user_id);
        const userCanAddAccount = isAdmin || user_id === ecopart_user_id;
        if (!userCanAddAccount) {
            throw new Error("User cannot add account to the desired ecopart user");
        }
    }

    formatEcotaxaAccountToCreate(ecotaxa_account_to_create: PublicEcotaxaAccountRequestCreationModel, ecotaxa_data: ecotaxaAccountModel): EcotaxaAccountRequestCreationModel {
        return {
            ecotaxa_account_ecopart_user_id: ecotaxa_account_to_create.ecopart_user_id,
            ecotaxa_account_token: ecotaxa_data.ecotaxa_token,
            ecotaxa_account_user_name: ecotaxa_data.ecotaxa_user_name,
            ecotaxa_account_user_email: ecotaxa_account_to_create.ecotaxa_user_login,
            ecotaxa_account_instance_id: ecotaxa_account_to_create.ecotaxa_instance_id,
            ecotaxa_account_expiration_date: ecotaxa_data.ecotaxa_expiration_date
        }
    }
}
