import { InstrumentModelRequestCreationModel, InstrumentModelRequestModel, InstrumentModelUpdateModel, InstrumentModelResponseModel } from "../../../domain/entities/instrument_model";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

export interface InstrumentModelDataSource {
    create(instrument: InstrumentModelRequestCreationModel): Promise<number>;
    getAll(options: PreparedSearchOptions): Promise<SearchResult<InstrumentModelResponseModel>>;
    updateOne(instrument: InstrumentModelUpdateModel): Promise<number>;
    getOne(instrument: InstrumentModelRequestModel): Promise<InstrumentModelResponseModel | null>;
}