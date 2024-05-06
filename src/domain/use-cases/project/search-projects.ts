import { FilterSearchOptions, PreparedSearchOptions, SearchInfo, SearchOptions, SearchResult } from "../../entities/search";
import { UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { SearchRepository } from "../../interfaces/repositories/search-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SearchProjectsUseCase } from "../../interfaces/use-cases/project/search-project";
import { ProjectResponseModel } from "../../entities/project";

export class SearchProject implements SearchProjectsUseCase {
    userRepository: UserRepository
    projectRepository: ProjectRepository
    searchRepository: SearchRepository

    constructor(userRepository: UserRepository, projectRepository: ProjectRepository, searchRepository: SearchRepository) {
        this.userRepository = userRepository
        this.projectRepository = projectRepository
        this.searchRepository = searchRepository
    }
    async execute(current_user: UserUpdateModel, options: SearchOptions, filters: FilterSearchOptions[]): Promise<{ projects: ProjectResponseModel[], search_info: SearchInfo }> {
        // DONE define wanted cases sensitivity : = is perfect match and LIKE is case insensitive

        // User should not be deleted
        if (await this.userRepository.isDeleted(current_user.user_id)) throw new Error("User is deleted");

        if (filters && filters.length > 0) {
            options.filter = this.searchRepository.formatFilters(filters);
        } else {
            options.filter = [];
        }

        // Check that options.sort_by is string and format it to PreparedSortingSearchOptions[]
        if (options.sort_by) {
            options.sort_by = this.searchRepository.formatSortBy(options.sort_by as string);
        }

        const result: SearchResult<ProjectResponseModel> = await this.projectRepository.standardGetProjects(options as PreparedSearchOptions);
        const projects: ProjectResponseModel[] = result.items//.map(user => this.userRepository.toPublicUser(user));


        const search_info: SearchInfo = {
            total: result.total,
            limit: parseInt(options.limit.toString()),
            total_on_page: projects.length,
            page: parseInt(options.page.toString()),
            pages: Math.ceil(result.total / options.limit) || 1
        };

        return { search_info, projects };
    }
}