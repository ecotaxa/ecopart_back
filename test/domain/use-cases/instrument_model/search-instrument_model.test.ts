import { InstrumentModelRepository } from "../../../../src/domain/interfaces/repositories/instrument_model-repository";
import { MockInstrumentModelRepository } from "../../../mocks/instrumentModel-mock";
import { MockSearchRepository } from "../../../mocks/search-mock";
import { SearchInstrumentModels } from '../../../../src/domain/use-cases/instrument_model/search-instrument_model';
import { instrument_model_response } from "../../../entities/instrumentModel";
import { SearchRepository } from "../../../../src/domain/interfaces/repositories/search-repository";


let mockInstrumentModelRepository: InstrumentModelRepository;
let mockSearchRepository: SearchRepository;

beforeEach(() => {
    jest.clearAllMocks();
    mockInstrumentModelRepository = new MockInstrumentModelRepository()
    mockSearchRepository = new MockSearchRepository()
})

describe("Domain - Use Cases - Search Instrument Models", () => {
    test("Search instrument models with filters, should be forced to empty ", async () => {
        const options = { filter: [{ field: "instrument_model_name", operator: "=", value: "UVP5" }], sort_by: [], page: 1, limit: 10 }
        const instruments = { items: [instrument_model_response], total: 1 }
        const search_info_response = { total: 1, page: 1, pages: 1, limit: 10, total_on_page: 1 }

        jest.spyOn(mockSearchRepository, 'formatSortBy').mockReturnValueOnce([]);
        jest.spyOn(mockInstrumentModelRepository, 'standardGetInstrumentModels').mockResolvedValueOnce(instruments);
        jest.spyOn(mockSearchRepository, 'formatSearchInfo').mockReturnValueOnce(search_info_response);


        const searchInstrumentModelsUseCase = new SearchInstrumentModels(mockInstrumentModelRepository, mockSearchRepository)
        const { instrument_models, search_info } = await searchInstrumentModelsUseCase.execute(options);

        expect(instrument_models.length).toBe(1);
        expect(search_info.total).toBe(1);
        expect(mockSearchRepository.formatSortBy).toHaveBeenCalledWith([]);
        expect(mockInstrumentModelRepository.standardGetInstrumentModels).toHaveBeenCalledWith({ filter: [], sort_by: [], page: 1, limit: 10 });
        expect(mockSearchRepository.formatSearchInfo).toHaveBeenCalledWith(instruments, options);
    });
    test("Throw error when searching instrument models", async () => {
        const options = { filter: [{ field: "instrument_model_name", operator: "=", value: "UVP5" }], sort_by: [], page: 1, limit: 10 }
        const search_info_response = { total: 1, page: 1, pages: 1, limit: 10, total_on_page: 1 }

        jest.spyOn(mockSearchRepository, 'formatSortBy').mockReturnValueOnce([]);
        jest.spyOn(mockInstrumentModelRepository, 'standardGetInstrumentModels').mockRejectedValueOnce(new Error());
        jest.spyOn(mockSearchRepository, 'formatSearchInfo').mockReturnValueOnce(search_info_response);

        try {
            const searchInstrumentModelsUseCase = new SearchInstrumentModels(mockInstrumentModelRepository, mockSearchRepository)
            await searchInstrumentModelsUseCase.execute(options);
        } catch (error) {
            expect(error.message).toBe("Cannot search instrument models");

            expect(mockSearchRepository.formatSortBy).toHaveBeenCalledWith([]);
            expect(mockInstrumentModelRepository.standardGetInstrumentModels).toHaveBeenCalledWith({ filter: [], sort_by: [], page: 1, limit: 10 });
            expect(mockSearchRepository.formatSearchInfo).not.toHaveBeenCalled();
        }
    });
});
