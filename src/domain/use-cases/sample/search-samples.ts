import { FilterSearchOptions, PreparedSearchOptions, SearchInfo, SearchOptions, SearchResult } from "../../entities/search";
import { UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { SearchRepository } from "../../interfaces/repositories/search-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { InstrumentModelRepository } from "../../interfaces/repositories/instrument_model-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SearchSamplesUseCase } from "../../interfaces/use-cases/sample/search-samples";
import { PublicSampleModel } from "../../entities/sample";

export class SearchSamples implements SearchSamplesUseCase {
    userRepository: UserRepository
    sampleRepository: SampleRepository
    searchRepository: SearchRepository
    instrumentModelRepository: InstrumentModelRepository
    privilegeRepository: PrivilegeRepository

    constructor(userRepository: UserRepository, sampleRepository: SampleRepository, searchRepository: SearchRepository, instrumentModelRepository: InstrumentModelRepository, privilegeRepository: PrivilegeRepository) {
        this.userRepository = userRepository
        this.sampleRepository = sampleRepository
        this.searchRepository = searchRepository
        this.instrumentModelRepository = instrumentModelRepository
        this.privilegeRepository = privilegeRepository
    }
    async execute(current_user: UserUpdateModel, options: SearchOptions, filters: FilterSearchOptions[], project_id?: number): Promise<{ samples: PublicSampleModel[], search_info: SearchInfo }> {

        // Ensure the current user is valid and not deleted
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        const is_cross_project = project_id === undefined || project_id === null;
        if (!is_cross_project) await this.ensureUserCanGet(current_user, project_id);

        // Prepare search options
        let prepared_options: PreparedSearchOptions = this.prepareSearchOptions(options, filters);

        // Apply additional filters
        prepared_options = await this.applyAdditionalFilters(current_user, prepared_options, project_id);

        // A cross-project search only covers the projects the user can access
        if (is_cross_project && !(await this.userRepository.isAdmin(current_user.user_id))) {
            const granted_project_ids = await this.privilegeRepository.getProjectsByUser({ user_id: current_user.user_id });
            // A user without any project gets no sample; do not rely on how the data source handles an empty IN
            if (granted_project_ids.length === 0) {
                return { search_info: this.searchRepository.formatSearchInfo({ total: 0, items: [] }, prepared_options), samples: [] };
            }
            prepared_options.filter.push({ field: "project_id", operator: "IN", value: granted_project_ids });
        }

        // Fetch samples based on prepared search options
        const result: SearchResult<PublicSampleModel> = await this.sampleRepository.standardGetSamples(prepared_options);
        const samples = result.items;

        // Format search info
        const search_info: SearchInfo = this.searchRepository.formatSearchInfo(result, prepared_options);

        return { search_info, samples };
    }

    private async ensureUserCanGet(current_user: UserUpdateModel, project_id: number): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isGranted({ user_id: current_user.user_id, project_id });
        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot access this project");
        }
    }


    // Prepares the search options by formatting filters and sort options.
    private prepareSearchOptions(options: SearchOptions, filters: FilterSearchOptions[]): PreparedSearchOptions {
        options.filter = filters && filters.length > 0 ? this.searchRepository.formatFilters(filters) : [];
        if (options.sort_by) options.sort_by = this.searchRepository.formatSortBy(options.sort_by as string);
        return options as PreparedSearchOptions;
    }

    // Applies additional filters based on specific conditions.
    private async applyAdditionalFilters(current_user: UserUpdateModel, options: PreparedSearchOptions, project_id?: number): Promise<PreparedSearchOptions> {
        if (options.filter.length > 0) {
            options = await this.applySampleTypeFilter(options);
            options = await this.applyVisualQCStatusFilter(options);
        }
        if (project_id !== undefined && project_id !== null) {
            const numericProjectId = typeof project_id === "string" ? parseInt(project_id, 10) : project_id;
            if (!isNaN(numericProjectId)) {
                options.filter.push({ field: "project_id", operator: "=", value: numericProjectId });
            }
        }
        return options;
    }

    // Applies the sample type filter.
    private async applySampleTypeFilter(options: PreparedSearchOptions): Promise<PreparedSearchOptions> {
        const sampleTypeModelFilter = options.filter.find(f => f.field === "sample_type_label");
        if (sampleTypeModelFilter) {
            // Delete the sample type label filter
            options.filter = options.filter.filter(f => f.field !== "sample_type_label");

            // If filter sample type label value is a string, replace it with the sample type id
            if (typeof sampleTypeModelFilter.value == "string") {
                const sampleTypeModel = await this.sampleRepository.getSampleType({ sample_type_label: sampleTypeModelFilter.value });
                // If sample type not found, throw an error
                if (!sampleTypeModel) {
                    throw new Error("Sample type not found");
                }
                // Replace the sample type label filter with the sample type id filter
                sampleTypeModelFilter.field = "sample_type_id";
                sampleTypeModelFilter.value = sampleTypeModel.sample_type_id;
                // Add the new filter to the options
                options.filter.push(sampleTypeModelFilter);
            }
        }
        return options;
    }
    // Applies the visual QC status filter.
    private async applyVisualQCStatusFilter(options: PreparedSearchOptions): Promise<PreparedSearchOptions> {
        const visualQCStatusFilter = options.filter.find(f => f.field === "visual_qc_status_label");
        if (visualQCStatusFilter) {
            // If filter visual QC status label value is a string, replace it with the visual QC status id
            if (typeof visualQCStatusFilter.value == "string") {
                const visualQCStatusModel = await this.sampleRepository.getVisualQCStatus({ visual_qc_status_label: visualQCStatusFilter.value });
                if (!visualQCStatusModel) {
                    throw new Error("Visual QC status not found");
                }
                visualQCStatusFilter.field = "visual_qc_status_id";
                visualQCStatusFilter.value = visualQCStatusModel.visual_qc_status_id;
                options.filter = options.filter.filter(f => f.field !== "visual_qc_status_label");
                options.filter.push(visualQCStatusFilter);
            }
        }
        return options;
    }

}
