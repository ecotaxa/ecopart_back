export interface InstrumentModelRequestCreationtModel {
    instrument_model_name: string;
}
export interface InstrumentModelResponseModel extends InstrumentModelRequestCreationtModel {
    instrument_model_id: number;
    instrument_model_creation_date: string;
}

export interface InstrumentModelRequestCreationtModel {
    instrument_model_name: string;
}

export interface InstrumentModelResponseModel extends InstrumentModelRequestCreationtModel {
    instrument_model_id: number;
    instrument_model_creation_date: string;
}
export interface InstrumentModelRequestModel {
    instrument_model_id?: number;
    instrument_model_name?: string;
}
export interface InstrumentModelUpdateModel extends InstrumentModelRequestCreationtModel {
    instrument_model_id: number;
}
