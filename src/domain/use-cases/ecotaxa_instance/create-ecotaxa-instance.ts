import { EcotaxaInstanceModel, EcotaxaInstanceRequestCreationModel } from "../../entities/ecotaxa_account";
import { UserUpdateModel } from "../../entities/user";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { CreateEcoTaxaInstanceUseCase } from "../../interfaces/use-cases/ecotaxa_instance/create-ecotaxa-instance";

export class CreateEcoTaxaInstance implements CreateEcoTaxaInstanceUseCase {
    userRepository: UserRepository
    ecotaxaAccountRepository: EcotaxaAccountRepository

    constructor(userRepository: UserRepository, ecotaxaAccountRepository: EcotaxaAccountRepository) {
        this.userRepository = userRepository
        this.ecotaxaAccountRepository = ecotaxaAccountRepository
    }

    async execute(current_user: UserUpdateModel, instance: EcotaxaInstanceRequestCreationModel): Promise<EcotaxaInstanceModel> {
        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Ensure the user is admin
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        if (!userIsAdmin) {
            throw new Error("Logged user cannot create an EcoTaxa instance");
        }

        // Create the instance
        const instance_id = await this.ecotaxaAccountRepository.createEcoTaxaInstance(instance);

        // Retrieve and return the created instance
        const created_instance = await this.ecotaxaAccountRepository.getOneEcoTaxaInstance(instance_id);
        if (!created_instance) {
            throw new Error("Cannot find created EcoTaxa instance");
        }

        return created_instance;
    }
}
