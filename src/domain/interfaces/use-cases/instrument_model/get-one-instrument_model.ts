import { InstrumentModelResponseModel } from "../../../entities/instrument_model";
export interface GetOneInstrumentModelUseCase {
    execute(instrument_model_id: number): Promise<InstrumentModelResponseModel>;
}