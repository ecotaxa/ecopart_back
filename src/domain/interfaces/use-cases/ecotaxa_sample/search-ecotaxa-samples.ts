import { EcoTaxaSampleListItem } from "../../../entities/sample";
import { FilterSearchOptions, SearchInfo, SearchOptions } from "../../../entities/search";
import { UserUpdateModel } from "../../../entities/user";

export interface SearchEcoTaxaSamplesUseCase {
    execute(current_user: UserUpdateModel, options: SearchOptions, filters: FilterSearchOptions[], project_id: number): Promise<{ items: EcoTaxaSampleListItem[], search_info: SearchInfo }>;
}
