import { FilterSearchOptions, SearchInfo, SearchOptions } from "../../../entities/search";
import { UserResponseModel, UserUpdateModel } from "../../../entities/user";
export interface SearchUsersUseCase {
    execute(current_user: UserUpdateModel, options: SearchOptions, filters: FilterSearchOptions[]): Promise<{ users: UserResponseModel[], search_info: SearchInfo }>;
}