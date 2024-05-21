import { PreparedSearchOptions, SearchInfo, SearchOptions } from "../../entities/search";
import { InstrumentModelResponseModel } from "../../entities/instrument_model";
import { InstrumentModelRepository } from "../../interfaces/repositories/instrument_model-repository";
import { SearchRepository } from "../../interfaces/repositories/search-repository";
import { SearchInstrumentModelsUseCase } from "../../interfaces/use-cases/instrument_model/search-instrument_model";

export class SearchInstrumentModels implements SearchInstrumentModelsUseCase {
    instrument_modelRepository: InstrumentModelRepository
    searchRepository: SearchRepository

    constructor(instrument_modelRepository: InstrumentModelRepository, searchRepository: SearchRepository) {
        this.instrument_modelRepository = instrument_modelRepository
        this.searchRepository = searchRepository
    }

    async execute(options: SearchOptions): Promise<{ instrument_models: InstrumentModelResponseModel[], search_info: SearchInfo }> {
        options.filter = [];

        // Check that options.sort_by is string and format it to PreparedSortingSearchOptions[]
        if (options.sort_by) {
            options.sort_by = this.searchRepository.formatSortBy(options.sort_by as string);
        }

        let instrument_models: InstrumentModelResponseModel[] = [];


        const result = await this.instrument_modelRepository.standardGetInstrumentModels(options as PreparedSearchOptions);
        instrument_models = result.items;


        const search_info: SearchInfo = {
            total: result.total,
            limit: parseInt(options.limit.toString()),
            total_on_page: instrument_models.length,
            page: parseInt(options.page.toString()),
            pages: Math.ceil(result.total / options.limit) || 1
        };

        return { search_info, instrument_models };
    }
}