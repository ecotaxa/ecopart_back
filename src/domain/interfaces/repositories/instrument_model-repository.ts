import { InstrumentModelRequestModel, InstrumentModelResponseModel } from "../../entities/instrument_model";
import { PreparedSearchOptions, SearchResult } from "../../entities/search";

export interface InstrumentModelRepository {
    getOneInstrumentModel(instrument_model: InstrumentModelRequestModel): Promise<InstrumentModelResponseModel | null>;
    standardGetInstrumentModels(options: PreparedSearchOptions): Promise<SearchResult<InstrumentModelResponseModel>>;
}