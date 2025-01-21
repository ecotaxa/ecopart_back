import { InstrumentModelDataSource } from "../../src/data/interfaces/data-sources/instrument_model-data-source";
import { InstrumentModelResponseModel } from "../../src/domain/entities/instrument_model";
import { SearchInfo, SearchResult } from "../../src/domain/entities/search";
import { InstrumentModelRepository } from "../../src/domain/interfaces/repositories/instrument_model-repository";
import { GetOneInstrumentModelUseCase } from "../../src/domain/interfaces/use-cases/instrument_model/get-one-instrument_model";
import { SearchInstrumentModelsUseCase } from "../../src/domain/interfaces/use-cases/instrument_model/search-instrument_model";

export class MockInstrumentModelRepository implements InstrumentModelRepository {
    getOneInstrumentModel(): Promise<InstrumentModelResponseModel | null> {
        throw new Error("Method not implemented for getOneInstrumentModel");
    }
    standardGetInstrumentModels(): Promise<SearchResult<InstrumentModelResponseModel>> {
        throw new Error("Method not implemented for standardGetInstrumentModels");
    }
    getInstrumentByName(): Promise<InstrumentModelResponseModel> {
        throw new Error("Method not implemented for getInstrumentByName");
    }
}

export class MockInstrumentModelDataSource implements InstrumentModelDataSource {
    create(): Promise<number> {
        throw new Error("Method not implemented : create");
    }
    getAll(): Promise<SearchResult<InstrumentModelResponseModel>> {
        throw new Error("Method not implemented : getAll");
    }
    updateOne(): Promise<number> {
        throw new Error("Method not implemented : updateOne");
    }
    getOne(): Promise<InstrumentModelResponseModel | null> {
        throw new Error("Method not implemented : getOne");
    }
    deleteOne(): Promise<number> {
        throw new Error("Method not implemented : deleteOne");
    }
}

export class MockGetOneInstrumentModelUseCase implements GetOneInstrumentModelUseCase {
    execute(): Promise<InstrumentModelResponseModel> {
        throw new Error("Method not implemented : execute");
    }
}
export class MockSearchInstrumentModelsUseCase implements SearchInstrumentModelsUseCase {
    execute(): Promise<{ instrument_models: InstrumentModelResponseModel[], search_info: SearchInfo }> {
        throw new Error("Method not implemented : execute");
    }
}