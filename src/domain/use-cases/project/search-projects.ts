import { FilterSearchOptions, PreparedSearchOptions, SearchInfo, SearchOptions, SearchResult } from "../../entities/search";
import { UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { SearchRepository } from "../../interfaces/repositories/search-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { InstrumentModelRepository } from "../../interfaces/repositories/instrument_model-repository";
import { SearchProjectsUseCase } from "../../interfaces/use-cases/project/search-project";
import { PublicProjectResponseModel } from "../../entities/project";

export class SearchProject implements SearchProjectsUseCase {
    userRepository: UserRepository
    projectRepository: ProjectRepository
    searchRepository: SearchRepository
    instrumentModelRepository: InstrumentModelRepository

    constructor(userRepository: UserRepository, projectRepository: ProjectRepository, searchRepository: SearchRepository, instrumentModelRepository: InstrumentModelRepository) {
        this.userRepository = userRepository
        this.projectRepository = projectRepository
        this.searchRepository = searchRepository
        this.instrumentModelRepository = instrumentModelRepository
    }
    async execute(current_user: UserUpdateModel, options: SearchOptions, filters: FilterSearchOptions[]): Promise<{ projects: PublicProjectResponseModel[], search_info: SearchInfo }> {
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

        // if filter on instrument model, searsch id of instrument model matching the filter and then set the filtyer to IN [] of instrument model id
        if (options.filter && options.filter.length > 0) {
            const instrument_model_filter = options.filter.find(f => f.field === "instrument_model");
            if (instrument_model_filter) {
                console.log(instrument_model_filter);
                const instrument_models = await this.instrumentModelRepository.standardGetInstrumentModels({ filter: [{ field: "instrument_model_name", operator: instrument_model_filter.operator, value: instrument_model_filter.value }], sort_by: [], limit: 1000, page: 1 });
                if (!instrument_models) {
                    throw new Error("Instrument model not found");
                }
                console.log(instrument_models);
                // set the new filter for instrument model operator to IN and value to array of instrument model id
                instrument_model_filter.field = "instrument_model";
                instrument_model_filter.operator = "IN";
                instrument_model_filter.value = instrument_models.items.map(i => i.instrument_model_id);
                console.log(instrument_model_filter);
                // remove the old filter
                options.filter = options.filter.filter(f => f.field !== "instrument_model");
                // add the new filter
                options.filter.push(instrument_model_filter);

            }
        }

        const result: SearchResult<PublicProjectResponseModel> = await this.projectRepository.standardGetProjects(options as PreparedSearchOptions);
        const projects: PublicProjectResponseModel[] = result.items//.map(user => this.userRepository.toPublicUser(user));


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