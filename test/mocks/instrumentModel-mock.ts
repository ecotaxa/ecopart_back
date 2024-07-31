import { InstrumentModelDataSource } from "../../src/data/interfaces/data-sources/instrument_model-data-source";
import { InstrumentModelResponseModel } from "../../src/domain/entities/instrument_model";
import { SearchResult } from "../../src/domain/entities/search";
import { InstrumentModelRepository } from "../../src/domain/interfaces/repositories/instrument_model-repository";

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