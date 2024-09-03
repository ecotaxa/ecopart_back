import { FilterSearchOptions, SearchInfo, SearchOptions } from "../../../entities/search";
import { TaskResponseModel } from "../../../entities/task";
import { UserUpdateModel } from "../../../entities/user";
export interface SearchTasksUseCase {
    //TODO AUTH ADD current user is not deleted and remove it from all use cases
    execute(current_user: UserUpdateModel, options: SearchOptions, filters: FilterSearchOptions[]): Promise<{ tasks: TaskResponseModel[], search_info: SearchInfo }>;
}