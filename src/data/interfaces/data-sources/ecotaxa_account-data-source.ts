import { EcotaxaAccountRequestCreationModel, EcotaxaAccountRequestModel, EcotaxaAccountResponseModel, EcotaxaInstanceModel } from "../../../domain/entities/ecotaxa_account";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

export interface EcotaxaAccountDataSource {
    create(ecotaxa_account: EcotaxaAccountRequestCreationModel): Promise<number>;
    getOne(ecotaxa_account_id: number): Promise<EcotaxaAccountResponseModel | null>;
    getAll(options: PreparedSearchOptions): Promise<SearchResult<EcotaxaAccountResponseModel>>;
    deleteOne(ecotaxa_account: EcotaxaAccountRequestModel): Promise<number>;
    getOneEcoTaxaInstance(ecotaxa_instance_id: number): Promise<EcotaxaInstanceModel | null>;
}