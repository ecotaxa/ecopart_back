import { FilterSearchOptions, PreparedSearchOptions, SearchInfo, SearchOptions } from "../../entities/search";
import { UserResponseModel, UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { SearchRepository } from "../../interfaces/repositories/search-repository";
import { SearchUsersUseCase } from "../../interfaces/use-cases/user/search-user";

export class SearchUsers implements SearchUsersUseCase {
    userRepository: UserRepository
    searchRepository: SearchRepository

    constructor(userRepository: UserRepository, searchRepository: SearchRepository) {
        this.userRepository = userRepository
        this.searchRepository = searchRepository
    }

    async execute(current_user: UserUpdateModel, options: SearchOptions, filters: FilterSearchOptions[]): Promise<{ users: UserResponseModel[], search_info: SearchInfo }> {
        // DONE define wanted cases sensitivity : = is perfect match and LIKE is case insensitive

        // User should not be deleted or invalid
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        if (filters && filters.length > 0) {
            options.filter = this.searchRepository.formatFilters(filters);
        } else {
            options.filter = [];
        }

        // Check that options.sort_by is string and format it to PreparedSortingSearchOptions[]
        if (options.sort_by) {
            options.sort_by = this.searchRepository.formatSortBy(options.sort_by as string);
        }

        let result;
        let users: UserResponseModel[] = [];

        // If admin, can search for deleted users
        if (await this.userRepository.isAdmin(current_user.user_id)) {
            result = await this.userRepository.adminGetUsers(options as PreparedSearchOptions);
            users = result.items;
        } else {
            result = await this.userRepository.standardGetUsers(options as PreparedSearchOptions);
            users = result.items.map(user => this.userRepository.toPublicUser(user));
        }

        const search_info: SearchInfo = this.searchRepository.formatSearchInfo(result, options);

        return { search_info, users };
    }
}