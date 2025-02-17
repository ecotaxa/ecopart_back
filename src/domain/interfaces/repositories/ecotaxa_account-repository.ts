import { EcotaxaAccountModel, EcotaxaAccountRequestCreationModel, EcotaxaAccountRequestModel, EcotaxaAccountResponseModel, EcotaxaInstanceModel, PublicEcotaxaAccountRequestCreationModel } from "../../entities/ecotaxa_account";

export interface EcotaxaAccountRepository {
    connectToEcotaxaInstance(ecotaxa_account_to_create: PublicEcotaxaAccountRequestCreationModel): Promise<EcotaxaAccountModel>;
    createEcotaxaAccount(private_ecotaxa_account_to_create: EcotaxaAccountRequestCreationModel): Promise<number>;
    getOneEcoTaxaInstance(ecotaxa_instance_id: number): Promise<EcotaxaInstanceModel | null>;
    accountExists(ecotaxa_account: PublicEcotaxaAccountRequestCreationModel): Promise<boolean>;
    getOneEcotaxaAccount(ecotaxa_account_id: number): Promise<EcotaxaAccountResponseModel | null>;
    formatEcotaxaAccountResponse(ecotaxa_account: EcotaxaAccountResponseModel): EcotaxaAccountModel;
    deleteEcotaxaAccount(ecotaxa_account: EcotaxaAccountRequestModel): Promise<number>;
}