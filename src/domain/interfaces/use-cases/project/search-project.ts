import { FilterSearchOptions, SearchInfo, SearchOptions } from "../../../entities/search";
import { ProjectResponseModel } from "../../../entities/project";
import { UserUpdateModel } from "../../../entities/user";
export interface SearchProjectsUseCase {
    //TODO AUTH ADD current user is not deleted and remove it from all use cases
    execute(current_user: UserUpdateModel, options: SearchOptions, filters: FilterSearchOptions[]): Promise<{ projects: ProjectResponseModel[], search_info: SearchInfo }>;
}