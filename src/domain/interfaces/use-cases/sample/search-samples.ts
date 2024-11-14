import { FilterSearchOptions, SearchInfo, SearchOptions } from "../../../entities/search";
import { PublicSampleModel } from "../../../entities/sample";
import { UserUpdateModel } from "../../../entities/user";
export interface SearchSamplesUseCase {
    execute(current_user: UserUpdateModel, options: SearchOptions, filters: FilterSearchOptions[], project_id?: number): Promise<{ samples: PublicSampleModel[], search_info: SearchInfo }>;
}