import { InstrumentModelResponseModel } from "../../entities/instrument_model";
import { InstrumentModelRepository } from "../../interfaces/repositories/instrument_model-repository";
import { GetOneInstrumentModelUseCase } from "../../interfaces/use-cases/instrument_model/get-one-instrument_model";

export class GetOneInstrumentModel implements GetOneInstrumentModelUseCase {
    instrument_model_Repository: InstrumentModelRepository

    constructor(instrument_modelRepository: InstrumentModelRepository) {
        this.instrument_model_Repository = instrument_modelRepository
    }

    async execute(instrument_model_id: number): Promise<InstrumentModelResponseModel> {
        const instrument_model = await this.instrument_model_Repository.getOneInstrumentModel({ instrument_model_id: instrument_model_id });
        if (!instrument_model) { throw new Error("Can't find instrument_model"); }
        return instrument_model;
    }
}