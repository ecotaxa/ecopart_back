import { EcotaxaInstanceModel } from "../../entities/ecotaxa_account";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { GetAllEcoTaxaInstancesUseCase } from "../../interfaces/use-cases/ecotaxa_instance/get-all-ecotaxa-instances";

export class GetAllEcoTaxaInstances implements GetAllEcoTaxaInstancesUseCase {
    ecotaxaAccountRepository: EcotaxaAccountRepository

    constructor(ecotaxaAccountRepository: EcotaxaAccountRepository) {
        this.ecotaxaAccountRepository = ecotaxaAccountRepository
    }

    async execute(): Promise<EcotaxaInstanceModel[]> {
        return await this.ecotaxaAccountRepository.getAllEcoTaxaInstances();
    }
}
