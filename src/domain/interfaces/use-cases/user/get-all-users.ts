import { SearchInfo, PaginedSearchOptions } from "../../../entities/search";
import { UserResponseModel, UserUpdateModel } from "../../../entities/user";
export interface GetAllUsersUseCase {
    execute(current_user: UserUpdateModel, options: PaginedSearchOptions): Promise<{ users: UserResponseModel[], search_info: SearchInfo }>;
}