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
        // Empty the filter array
        options.filter = [];

        // Check that options.sort_by are asked and format them if they are
        if (options.sort_by) {
            options.sort_by = this.searchRepository.formatSortBy(options.sort_by as string);
        }

        try {
            // Fetch the instrument models from the repository using the prepared search options
            const result = await this.instrument_modelRepository.standardGetInstrumentModels(options as PreparedSearchOptions);
            const instrument_models: InstrumentModelResponseModel[] = result.items;

            // Format the search information using the search repository
            const search_info: SearchInfo = this.searchRepository.formatSearchInfo(result, options);

            return { search_info, instrument_models };
        } catch (error) {
            throw new Error("Cannot search instrument models");
        }

    }
}