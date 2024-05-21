
import { SearchInfo, SearchOptions } from "../../../entities/search";
import { InstrumentModelResponseModel } from "../../../entities/instrument_model";
export interface SearchInstrumentModelsUseCase {
    execute(options: SearchOptions): Promise<{ instrument_models: InstrumentModelResponseModel[], search_info: SearchInfo }>;
}