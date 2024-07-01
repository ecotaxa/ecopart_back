
// define an example of project entities to use in the tests

import { InstrumentModelResponseModel } from "../../src/domain/entities/instrument_model"

export const instrument_model_response: InstrumentModelResponseModel = {
    instrument_model_id: 1,
    instrument_model_creation_date: '2023-08-01 10:30:00',
    instrument_model_name: "UVP5HD",
    bodc_url: "http://uvp5hd.com",
}