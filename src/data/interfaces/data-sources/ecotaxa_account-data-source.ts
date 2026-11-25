import { EcotaxaAccountRequestCreationModel, EcotaxaAccountRequestModel, EcotaxaAccountResponseModel, EcotaxaInstanceModel, EcotaxaInstanceRequestCreationModel } from "../../../domain/entities/ecotaxa_account";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

export interface EcotaxaAccountDataSource {
    create(ecotaxa_account: EcotaxaAccountRequestCreationModel): Promise<number>;
    getOne(ecotaxa_account_id: number): Promise<EcotaxaAccountResponseModel | null>;
    getAll(options: PreparedSearchOptions): Promise<SearchResult<EcotaxaAccountResponseModel>>;
    deleteOne(ecotaxa_account: EcotaxaAccountRequestModel): Promise<number>;
    updateToken(ecotaxa_account_id: number, ecotaxa_account_token: string): Promise<number>;
    updateTokens(ecotaxa_account_id: number, ecotaxa_account_token: string, ecotaxa_account_refresh_token: string | null, ecotaxa_account_expiration_utc_date_time: string): Promise<number>;
    updateExpiration(ecotaxa_account_id: number, ecotaxa_account_expiration_utc_date_time: string): Promise<number>;
    getOneEcoTaxaInstance(ecotaxa_instance_id: number): Promise<EcotaxaInstanceModel | null>;
    getAllEcoTaxaInstances(): Promise<EcotaxaInstanceModel[]>;
    createEcoTaxaInstance(instance: EcotaxaInstanceRequestCreationModel): Promise<number>;
}