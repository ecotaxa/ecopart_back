
import { InstrumentModelDataSource } from "../../data/interfaces/data-sources/instrument_model-data-source";
import { InstrumentModelRequestModel, InstrumentModelResponseModel } from "../entities/instrument_model";
import { PreparedSearchOptions, SearchResult } from "../entities/search";
import { InstrumentModelRepository } from "../interfaces/repositories/instrument_model-repository";

export class InstrumentModelRepositoryImpl implements InstrumentModelRepository {
    instrument_modelDataSource: InstrumentModelDataSource

    // // TODO move to a search repository
    order_by_allow_params: string[] = ["asc", "desc"]
    filter_operator_allow_params: string[] = ["=", ">", "<", ">=", "<=", "<>", "IN", "LIKE"]

    constructor(instrument_modelDataSource: InstrumentModelDataSource) {
        this.instrument_modelDataSource = instrument_modelDataSource
    }

    async getOneInstrumentModel(instrument_model_id: InstrumentModelRequestModel): Promise<InstrumentModelResponseModel | null> {
        const result = await this.instrument_modelDataSource.getOne(instrument_model_id);
        return result;
    }

    async standardGetInstrumentModels(options: PreparedSearchOptions): Promise<SearchResult<InstrumentModelResponseModel>> { //TODO
        // Can be filtered by 
        const filter_params_restricted: string[] = ["instrument_model_name"]

        // Can be sort_by 
        const sort_param_restricted: string[] = ["instrument_model_id", "instrument_model_name", "bodc_url", "instrument_model_creation_date"]

        return await this.getInstrumentModels(options, filter_params_restricted, sort_param_restricted, this.order_by_allow_params, this.filter_operator_allow_params)
    }

    // //TODO MOVE TO SEARCH REPOSITORY
    private async getInstrumentModels(options: PreparedSearchOptions, filtering_params: string[], sort_by_params: string[], order_by_params: string[], filter_operator_params: string[]): Promise<SearchResult<InstrumentModelResponseModel>> {
        const unauthorizedParams: string[] = [];
        //TODO move to a search repository
        // Filter options.sort_by by sorting params 
        options.sort_by = options.sort_by.filter(sort_by => {
            let is_valid = true;
            if (!sort_by_params.includes(sort_by.sort_by)) {
                unauthorizedParams.push(`Unauthorized sort_by: ${sort_by.sort_by}`);
                is_valid = false;
            }
            if (!order_by_params.includes(sort_by.order_by)) {
                unauthorizedParams.push(`Unauthorized order_by: ${sort_by.order_by}`);
                is_valid = false;
            }
            return is_valid;
        });

        //TODO move to a search repository
        // Filter options.filters by filtering params
        options.filter = options.filter.filter(filter => {
            let is_valid = true;
            if (!filtering_params.includes(filter.field)) {
                unauthorizedParams.push(`Filter field: ${filter.field}`);
                is_valid = false;
            }
            if (!filter_operator_params.includes(filter.operator)) {
                unauthorizedParams.push(`Filter operator: ${filter.operator}`);
                is_valid = false;
            }
            return is_valid;
        });

        //TODO move to a search repository
        if (unauthorizedParams.length > 0) {
            throw new Error(`Unauthorized or unexisting parameters : ${unauthorizedParams.join(', ')}`);
        }

        return await this.instrument_modelDataSource.getAll(options);
    }

    // Get instrument by its model name
    async getInstrumentByName(instrumentModelName: string): Promise<InstrumentModelResponseModel> {
        const instrument = await this.getOneInstrumentModel({ instrument_model_name: instrumentModelName });
        if (!instrument) throw new Error("Instrument not found");
        return instrument;
    }


}