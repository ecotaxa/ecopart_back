import { EcotaxaAccountModel, EcotaxaAccountRequestCreationModel, EcotaxaAccountRequestModel, EcotaxaAccountResponseModel, EcotaxaInstanceModel, PublicEcotaxaAccountRequestCreationModel, PublicEcotaxaAccountResponseModel } from "../../entities/ecotaxa_account";
import { PublicProjectRequestCreationModel } from "../../entities/project";
import { PreparedSearchOptions, SearchResult } from "../../entities/search";

export interface EcotaxaAccountRepository {
    linkEcotaxaAndEcopartProject(public_project: PublicProjectRequestCreationModel): Promise<number>;
    createEcotaxaProject(ecopart_project: PublicProjectRequestCreationModel): Promise<number>
    ecotaxa_account_belongs(user_id: number, ecotaxa_account_id: number): Promise<boolean>;
    createEcotaxaAccount(private_ecotaxa_account_to_create: EcotaxaAccountRequestCreationModel): Promise<number>;
    connectToEcotaxaInstance(ecotaxa_account_to_create: PublicEcotaxaAccountRequestCreationModel): Promise<EcotaxaAccountModel>;
    accountExists(ecotaxa_account: PublicEcotaxaAccountRequestCreationModel): Promise<boolean>;
    getOneEcotaxaAccount(ecotaxa_account_id: number, ecopart_user_id?: number): Promise<EcotaxaAccountResponseModel | null>;
    formatEcotaxaAccountResponse(ecotaxa_account: EcotaxaAccountResponseModel): PublicEcotaxaAccountResponseModel;
    deleteEcotaxaAccount(ecotaxa_account: EcotaxaAccountRequestModel): Promise<number>;
    standardGetEcotaxaAccountsModels(options: PreparedSearchOptions): Promise<SearchResult<EcotaxaAccountResponseModel>>;
    getOneEcoTaxaInstance(ecotaxa_instance_id: number): Promise<EcotaxaInstanceModel | null>;
}