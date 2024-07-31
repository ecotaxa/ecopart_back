
// define an example of project entities to use in the tests

import { InstrumentModelRequestCreationModel, InstrumentModelRequestModel, InstrumentModelResponseModel } from "../../src/domain/entities/instrument_model"

export const instrument_model_response: InstrumentModelResponseModel = {
    instrument_model_id: 1,
    instrument_model_creation_date: '2023-08-01 10:30:00',
    instrument_model_name: "UVP5HD",
    bodc_url: "http://uvp5hd.com",
}
export const instrument_model_response_UVP6: InstrumentModelResponseModel = {
    instrument_model_id: 2,
    instrument_model_creation_date: '2024-08-01 10:30:00',
    instrument_model_name: "UVP6HF",
    bodc_url: "http://uvp6hf.com",
}
export const instrument_model_creation_UVP5HD: InstrumentModelRequestCreationModel = {
    instrument_model_name: "UVP5HD",
    bodc_url: "http://uvp5hd.com",
}
export const instrument_model_creation_UVP6HF: InstrumentModelRequestCreationModel = {
    instrument_model_name: "UVP6HF",
    bodc_url: "http://uvp6hf.com",
}
export const instrument_model_request_id: InstrumentModelRequestModel = {
    instrument_model_id: 1,
}
export const instrument_model_request_name: InstrumentModelRequestModel = {
    instrument_model_name: "UVP5HD",
}