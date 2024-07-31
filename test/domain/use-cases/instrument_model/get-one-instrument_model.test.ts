import { InstrumentModelRepository } from "../../../../src/domain/interfaces/repositories/instrument_model-repository";
import { MockInstrumentModelRepository } from "../../../mocks/instrumentModel-mock";
import { GetOneInstrumentModel } from '../../../../src/domain/use-cases/instrument_model/get-one-instrument_model';
import { instrument_model_response } from "../../../entities/instrumentModel";


let mockInstrumentModelRepository: InstrumentModelRepository;

beforeEach(() => {
    jest.clearAllMocks();
    mockInstrumentModelRepository = new MockInstrumentModelRepository()
})

describe("Domain - Use Cases - Get One Instrument Model", () => {
    test("Get one instrument model by id : Ok ", async () => {
        const getOneInstrumentModelUseCase = new GetOneInstrumentModel(mockInstrumentModelRepository)
        jest.spyOn(mockInstrumentModelRepository, 'getOneInstrumentModel').mockResolvedValueOnce(instrument_model_response);

        const instrumentModel = await getOneInstrumentModelUseCase.execute(1);
        expect(instrumentModel.instrument_model_id).toBe(1);
    });
    test("Get one instrument model by id : Not found ", async () => {
        const getOneInstrumentModelUseCase = new GetOneInstrumentModel(mockInstrumentModelRepository)
        jest.spyOn(mockInstrumentModelRepository, 'getOneInstrumentModel').mockResolvedValueOnce(null);
        await expect(getOneInstrumentModelUseCase.execute(2)).rejects.toThrow("Cannot find instrument_model");

    });
});