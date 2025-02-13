import { ecotaxaAccountModel, EcotaxaAccountRequestCreationModel, EcotaxaAccountRequestModel, EcotaxaInstanceModel, PublicEcotaxaAccountRequestCreationModel } from "../../entities/ecotaxa_account";

export interface EcotaxaAccountRepository {
    connectToEcotaxaInstance(ecotaxa_account_to_create: PublicEcotaxaAccountRequestCreationModel): Promise<ecotaxaAccountModel>;
    createEcotaxaAccount(private_ecotaxa_account_to_create: EcotaxaAccountRequestCreationModel): Promise<void>;
    getOneEcoTaxaInstance(ecotaxa_instance_id: number): Promise<EcotaxaInstanceModel | null>;
    accountExists(ecotaxa_account: PublicEcotaxaAccountRequestCreationModel): Promise<boolean>;
    getOneEcotaxaAccount(ecotaxa_account_id: number): Promise<EcotaxaAccountRequestCreationModel | null>;
    deleteEcotaxaAccount(ecotaxa_account: EcotaxaAccountRequestModel): Promise<number>;
}