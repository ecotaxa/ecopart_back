import { FilterSearchOptions, PreparedSearchOptions, SearchInfo, SearchOptions, SearchResult } from "../../entities/search";
import { UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { SearchRepository } from "../../interfaces/repositories/search-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { InstrumentModelRepository } from "../../interfaces/repositories/instrument_model-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SearchProjectsUseCase } from "../../interfaces/use-cases/project/search-project";
import { ProjectResponseModel, PublicProjectResponseModel } from "../../entities/project";

export class SearchProject implements SearchProjectsUseCase {
    userRepository: UserRepository
    projectRepository: ProjectRepository
    searchRepository: SearchRepository
    instrumentModelRepository: InstrumentModelRepository
    privilegeRepository: PrivilegeRepository

    constructor(userRepository: UserRepository, projectRepository: ProjectRepository, searchRepository: SearchRepository, instrumentModelRepository: InstrumentModelRepository, privilegeRepository: PrivilegeRepository) {
        this.userRepository = userRepository
        this.projectRepository = projectRepository
        this.searchRepository = searchRepository
        this.instrumentModelRepository = instrumentModelRepository
        this.privilegeRepository = privilegeRepository
    }
    async execute(current_user: UserUpdateModel, options: SearchOptions, filters: FilterSearchOptions[]): Promise<{ projects: PublicProjectResponseModel[], search_info: SearchInfo }> {
        // DONE define wanted cases sensitivity : = is perfect match and LIKE is case insensitive

        // Ensure the current user is valid and not deleted
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Prepare search options
        let prepared_options: PreparedSearchOptions = this.prepareSearchOptions(options, filters);

        // Apply additional filters
        prepared_options = await this.applyAdditionalFilters(current_user, prepared_options);

        // Fetch projects based on prepared search options
        const result: SearchResult<ProjectResponseModel> = await this.projectRepository.standardGetProjects(prepared_options);

        // Map projects to public project response models
        const projects = await this.mapToPublicProjects(result);

        // Format search info
        const search_info: SearchInfo = this.searchRepository.formatSearchInfo(result, prepared_options);

        return { search_info, projects };
    }


    // Prepares the search options by formatting filters and sort options.
    private prepareSearchOptions(options: SearchOptions, filters: FilterSearchOptions[]): PreparedSearchOptions {
        options.filter = filters && filters.length > 0 ? this.searchRepository.formatFilters(filters) : [];
        if (options.sort_by) options.sort_by = this.searchRepository.formatSortBy(options.sort_by as string);
        return options as PreparedSearchOptions;
    }

    // Applies additional filters based on specific conditions.
    private async applyAdditionalFilters(current_user: UserUpdateModel, options: PreparedSearchOptions): Promise<PreparedSearchOptions> {
        if (options.filter.length > 0) {
            options = await this.applyInstrumentModelFilter(options);
            options = await this.applyManagingFilter(current_user, options);
            options = await this.applyContactFilter(options);
            options = await this.applyUserFilters(options, "managers")//, this.privilegeRepository.getProjectsByManagers);
            options = await this.applyUserFilters(options, "members")//, this.privilegeRepository.getProjectsByMembers);
            options = await this.applyUserFilters(options, "granted_users")//, this.privilegeRepository.getProjectsByUsers);
        }
        return options;
    }

    // Applies the instrument model filter.
    private async applyInstrumentModelFilter(options: PreparedSearchOptions): Promise<PreparedSearchOptions> {
        // If filter on instrument model, searsch id of instrument model matching the filter and then set the filter to IN [] of instrument model id
        const instrumentModelFilter = options.filter.find(f => f.field === "instrument_model");
        if (instrumentModelFilter) {
            const instrumentModels = await this.instrumentModelRepository.standardGetInstrumentModels({
                filter: [{ field: "instrument_model_name", operator: instrumentModelFilter.operator, value: instrumentModelFilter.value }],
                sort_by: [],
                limit: 1000,
                page: 1
            });

            if (!instrumentModels) {
                throw new Error("Instrument model not found");
            }

            // Set the new filter for instrument model operator to IN and value to array of instrument model id
            instrumentModelFilter.field = "instrument_model";
            instrumentModelFilter.operator = "IN";
            instrumentModelFilter.value = instrumentModels.items.map(i => i.instrument_model_id);

            // Remove the old filter
            options.filter = options.filter.filter(f => f.field !== "instrument_model");
            // Add the new filter
            options.filter.push(instrumentModelFilter);
        }
        return options;
    }

    // Applies the managing filter.
    private async applyManagingFilter(current_user: UserUpdateModel, options: PreparedSearchOptions): Promise<PreparedSearchOptions> {
        const managingFilter = options.filter.find(f => f.field === "for_managing");
        // If filter is for managing = true, get all projects where current_user have at least one privilege
        if (managingFilter) {
            // Delete the filter
            options.filter = options.filter.filter(f => f.field !== "for_managing");

            // If filter is for managing = true, get all projects where current_user have at least one privilege
            if (managingFilter.value === "true") {
                const projectIds = await this.privilegeRepository.getProjectsByUser({ user_id: current_user.user_id });
                // Add the new filter to the list of filters
                options.filter.push({ field: "project_id", operator: "IN", value: projectIds });
            }
        }
        return options;
    }

    // Applies the contact filter.
    private async applyContactFilter(options: PreparedSearchOptions): Promise<PreparedSearchOptions> {
        const contactFilter = options.filter.find(f => f.field === "contact");
        if (contactFilter) {
            // Delete the filter
            options.filter = options.filter.filter(f => f.field !== "contact");
            // Get user ids from the filter
            const userIds = this.extractUserIds(contactFilter);
            // Get projects by contacts
            const projectIds = await this.privilegeRepository.getProjectsByContacts(userIds);
            // Add the new filter to the list of filters
            options.filter.push({ field: "project_id", operator: "IN", value: projectIds });
        }
        return options;
    }

    // Applies user-based filters such as managers, members, and granted_users
    private async applyUserFilters(
        options: PreparedSearchOptions,
        filterField: string
    ): Promise<PreparedSearchOptions> {
        const userFilter = options.filter.find(f => f.field === filterField);
        let projectIds;
        if (userFilter) {
            options.filter = options.filter.filter(f => f.field !== filterField);
            const userIds = this.extractUserIds(userFilter);
            if (filterField === "managers") {
                projectIds = await this.privilegeRepository.getProjectsByManagers(userIds);
            } else if (filterField === "members") {
                projectIds = await this.privilegeRepository.getProjectsByMembers(userIds);
            } else if (filterField === "granted_users") {
                projectIds = await this.privilegeRepository.getProjectsByUsers(userIds);
            } else {
                throw new Error("Invalid filter field");
            }
            options.filter.push({ field: "project_id", operator: "IN", value: projectIds });
        }
        return options;
    }

    // Extracts user IDs from a filter.
    private extractUserIds(filter: FilterSearchOptions): number[] {
        let userIds;
        if (filter.operator === "IN") {
            userIds = filter.value;
            if (!Array.isArray(userIds) || userIds.length === 0 || userIds.some(id => typeof id !== "number")) {
                throw new Error(`${filter.field} should be an array of numbers`);
            }
        } else if (filter.operator === "=") {
            if (typeof filter.value !== "number") {
                throw new Error(`${filter.field} should be a number`);
            }
            userIds = [filter.value];
        } else {
            throw new Error(`${filter.field} should be an array of numbers or a number`);
        }
        return userIds;
    }

    // Maps projects to public project response models.
    private async mapToPublicProjects(result: SearchResult<ProjectResponseModel>): Promise<PublicProjectResponseModel[]> {
        return Promise.all(result.items.map(async project => {
            const privileges = await this.privilegeRepository.getPublicPrivileges({ project_id: project.project_id });
            if (!privileges) throw new Error("Cannot find privileges");
            return this.projectRepository.toPublicProject(project, privileges);
        }));
    }
}
