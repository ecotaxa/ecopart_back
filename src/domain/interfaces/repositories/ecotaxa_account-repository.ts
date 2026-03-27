import { EcotaxaAccountModel, EcotaxaAccountRequestCreationModel, EcotaxaAccountRequestModel, EcotaxaAccountResponseModel, EcotaxaInstanceModel, PublicEcotaxaAccountRequestCreationModel, PublicEcotaxaAccountResponseModel } from "../../entities/ecotaxa_account";
import { ProjectResponseModel, PublicProjectRequestCreationModel, PublicProjectUpdateModel } from "../../entities/project";
import { PublicImportableEcoTaxaSampleResponseModel } from "../../entities/sample";
import { PreparedSearchOptions, SearchResult } from "../../entities/search";
import { UserUpdateModel } from "../../entities/user";

export interface EcotaxaAccountRepository {
    api_ecotaxa_query_objects_by_sample(baseUrl: string, token: string, ecotaxa_project_id: number, sample_name: string[]): Promise<number[]>;
    api_ecotaxa_delete_objects(baseUrl: string, token: string, objectIds: number[]): Promise<void>;
    api_delete_ecotaxa_project(baseUrl: string, token: string, ecotaxa_project_id: number): Promise<void>;
    importEcoTaxaSamplesInEcoTaxa(ecotaxa_user: EcotaxaAccountRequestModel, samples_to_import: PublicImportableEcoTaxaSampleResponseModel[], project: ProjectResponseModel): Promise<string[]>;
    deleteEcopartUserFromEcotaxaProject(current_project: ProjectResponseModel, project_to_update_model: PublicProjectUpdateModel): Promise<void>;
    linkEcotaxaAndEcopartProject(public_project: PublicProjectRequestCreationModel): Promise<{ ecotaxa_project_id: number, ecotaxa_project_name: string }>;
    createEcotaxaProject(ecopart_project: PublicProjectRequestCreationModel): Promise<number>;
    ecotaxa_account_belongs(user_id: number, ecotaxa_account_id: number): Promise<boolean>;
    createEcotaxaAccount(private_ecotaxa_account_to_create: EcotaxaAccountRequestCreationModel): Promise<number>;
    connectToEcotaxaInstance(ecotaxa_account_to_create: PublicEcotaxaAccountRequestCreationModel): Promise<EcotaxaAccountModel>;
    accountExists(ecotaxa_account: PublicEcotaxaAccountRequestCreationModel): Promise<boolean>;
    getOneEcotaxaAccount(ecotaxa_account_id: number, ecopart_user_id?: number): Promise<EcotaxaAccountResponseModel | null>;
    formatEcotaxaAccountResponse(ecotaxa_account: EcotaxaAccountResponseModel): PublicEcotaxaAccountResponseModel;
    deleteEcotaxaAccount(ecotaxa_account: EcotaxaAccountRequestModel): Promise<number>;
    standardGetEcotaxaAccountsModels(options: PreparedSearchOptions): Promise<SearchResult<EcotaxaAccountResponseModel>>;
    getOneEcoTaxaInstance(ecotaxa_instance_id: number): Promise<EcotaxaInstanceModel | null>;
    ensureUserCanUseEcotaxaAccount(current_user: UserUpdateModel, ecotaxa_account_id: number): Promise<void>;
    ensureEcotaxaInstanceConsistency(public_project: PublicProjectRequestCreationModel | PublicProjectUpdateModel): Promise<void>;
    getEcotaxaGenericAccountForInstance(ecotaxa_instance_id: number): Promise<EcotaxaAccountResponseModel>;
}