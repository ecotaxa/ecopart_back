export interface InstrumentModelRequestCreationModel {
    instrument_model_name: string;
    bodc_url: string;
}
export interface InstrumentModelResponseModel extends InstrumentModelRequestCreationModel {
    instrument_model_id: number;
    instrument_model_creation_utc_date_time: string;
}

export interface InstrumentModelRequestCreationModel {
    instrument_model_name: string;
    bodc_url: string;
}

export interface InstrumentModelResponseModel extends InstrumentModelRequestCreationModel {
    instrument_model_id: number;
    instrument_model_creation_utc_date_time: string;
}
export interface InstrumentModelRequestModel {
    instrument_model_id?: number;
    instrument_model_name?: string;
    bodc_url?: string;
}
export interface InstrumentModelUpdateModel extends InstrumentModelRequestCreationModel {
    instrument_model_id: number;
}
