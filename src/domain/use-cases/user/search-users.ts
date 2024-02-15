import { FilterSearchOptions, PreparedSearchOptions, SearchInfo, SearchOptions } from "../../entities/search";
import { UserResponseModel, UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { SearchUsersUseCase } from "../../interfaces/use-cases/user/search-user";

export class SearchUsers implements SearchUsersUseCase {
    userRepository: UserRepository
    constructor(userRepository: UserRepository) {
        this.userRepository = userRepository
    }

    async execute(current_user: UserUpdateModel, options: SearchOptions, filters: FilterSearchOptions[]): Promise<{ users: UserResponseModel[], search_info: SearchInfo }> {
        // TODO throw errors if unauthorize opion is used
        // TODO handle empty result
        // TODO define wanted cases sensitivity
        // TODO handle add info about the filtering 
        // TODO add info about sorting Or trow errors if unauthorize opion is used

        // User should not be deleted
        if (await this.userRepository.isDeleted(current_user.user_id)) throw new Error("User is deleted");

        if (options.page) {
            // Check that options.page is int
            if (options.page && isNaN(parseInt(options.page.toString()))) throw new Error("Page must be a number");
            // Cast options.page to int
            if (options.page) options.page = parseInt(options.page.toString());
            // Check options.page to be positive
            if (options.page && options.page < 1) throw new Error("Page too low");
        } else {
            // Default to page 1 if not specified
            options.page = 1
        }

        if (options.limit) {
            // Check that options.limit is int
            if (options.limit && isNaN(parseInt(options.limit.toString()))) throw new Error("Limit must be a number");
            // Cast options.limit to int
            if (options.limit) options.limit = parseInt(options.limit.toString());
            // Check options.limit to be positive
            if (options.limit && options.limit < 0) throw new Error("Limit too low");
        } else {
            // Default to 10 items per page if not specified
            options.limit = 10
        }
        if (filters && filters.length > 0) {
            // Check if filters objects contains filed, operator and value
            options.filter = this.userRepository.formatFilters(filters);
            console.log(options.filter)
        } else {
            // Set no filter by default
            options.filter = [];
        }

        // Check that options.sort_by is string and format it to PreparedSortingSearchOptions[]
        if (options.sort_by) {
            options.sort_by = this.userRepository.formatSortBy(options.sort_by as string);
        }
        // Default to sort by user_id ASC if not specified ou badly specified
        if (!options.sort_by || options.sort_by.length === 0) {
            options.sort_by = [{ sort_by: "user_id", order_by: "desc" }]
        }

        let result;
        let users: UserResponseModel[] = [];

        // If admin, can search for deleted users
        if (await this.userRepository.isAdmin(current_user.user_id)) {
            result = await this.userRepository.adminGetUsers(options as PreparedSearchOptions);
            users = result.users;
            // Const total =result.total; // Total number of users matching the filter
        } else {
            result = await this.userRepository.standardGetUsers(options as PreparedSearchOptions);
            // Const total =result.total; // Total number of users matching the filter
            users = result.users.map(user => this.userRepository.toPublicUser(user));
        }

        const search_info: SearchInfo = {
            total: result.total,
            limit: options.limit || 10, // Default to 10 items per page if not specified
            total_on_page: users.length,
            page: options.page || 1, // Default to page 1 if not specified
            pages: Math.ceil(result.total / (options.limit || 1)) //total
        };

        return { search_info, users };
    }
}