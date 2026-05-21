import { EcoTaxaSampleListItem } from "../../entities/sample";
import { FilterSearchOptions, PreparedSearchOptions, SearchInfo, SearchOptions } from "../../entities/search";
import { UserUpdateModel } from "../../entities/user";
import { EcotaxaAccountRepository } from "../../interfaces/repositories/ecotaxa_account-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { SearchRepository } from "../../interfaces/repositories/search-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { SearchEcoTaxaSamplesUseCase } from "../../interfaces/use-cases/ecotaxa_sample/search-ecotaxa-samples";

export class SearchEcoTaxaSamples implements SearchEcoTaxaSamplesUseCase {
    userRepository: UserRepository
    sampleRepository: SampleRepository
    privilegeRepository: PrivilegeRepository
    projectRepository: ProjectRepository
    searchRepository: SearchRepository
    ecotaxaAccountRepository: EcotaxaAccountRepository

    constructor(
        userRepository: UserRepository,
        sampleRepository: SampleRepository,
        privilegeRepository: PrivilegeRepository,
        projectRepository: ProjectRepository,
        searchRepository: SearchRepository,
        ecotaxaAccountRepository: EcotaxaAccountRepository,
    ) {
        this.userRepository = userRepository
        this.sampleRepository = sampleRepository
        this.privilegeRepository = privilegeRepository
        this.projectRepository = projectRepository
        this.searchRepository = searchRepository
        this.ecotaxaAccountRepository = ecotaxaAccountRepository
    }

    async execute(current_user: UserUpdateModel, options: SearchOptions, filters: FilterSearchOptions[], project_id: number): Promise<{ items: EcoTaxaSampleListItem[], search_info: SearchInfo }> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        if (!userIsAdmin) {
            const userHasPrivilege = await this.privilegeRepository.isGranted({ user_id: current_user.user_id, project_id });
            if (!userHasPrivilege) {
                throw new Error("Logged user cannot get EcoTaxa samples for this project");
            }
        }

        const project = await this.projectRepository.getProject({ project_id });
        if (!project) {
            throw new Error("Cannot find project");
        }
        if (project.ecotaxa_instance_id === null || project.ecotaxa_instance_id === undefined) {
            throw new Error("Project is not linked to an EcoTaxa instance");
        }

        const prepared_options = this.prepareSearchOptions(options, filters, project_id);
        const result = await this.sampleRepository.standardGetEcoTaxaSampleSummaries(prepared_options);
        const search_info: SearchInfo = this.searchRepository.formatSearchInfo(result, prepared_options);

        if (result.items.length === 0) {
            return { items: [], search_info };
        }

        const ecotaxa_instance = await this.ecotaxaAccountRepository.getOneEcoTaxaInstance(project.ecotaxa_instance_id);
        if (!ecotaxa_instance) {
            throw new Error("Ecotaxa instance not found");
        }
        const generic_account = await this.ecotaxaAccountRepository.getEcotaxaGenericAccountForInstance(project.ecotaxa_instance_id);

        const ecotaxa_sample_ids = result.items.map(i => i.ecotaxa_sample_id);
        const stats = await this.ecotaxaAccountRepository.api_ecotaxa_get_sample_stats(
            ecotaxa_instance.ecotaxa_instance_url,
            generic_account.ecotaxa_account_token,
            ecotaxa_sample_ids,
        );
        const stats_by_id = new Map(stats.map(s => [s.sample_id, s]));

        const items: EcoTaxaSampleListItem[] = result.items.map(summary => {
            const s = stats_by_id.get(summary.ecotaxa_sample_id);
            const nb_unclassified = s?.nb_unclassified ?? 0;
            const nb_validated = s?.nb_validated ?? 0;
            const nb_dubious = s?.nb_dubious ?? 0;
            const nb_predicted = s?.nb_predicted ?? 0;
            return {
                sample_id: summary.sample_id,
                sample_name: summary.sample_name,
                ecotaxa_sample_id: summary.ecotaxa_sample_id,
                nb_objects: nb_unclassified + nb_validated + nb_dubious + nb_predicted,
                nb_unclassified,
                nb_validated,
                nb_dubious,
                nb_predicted,
            };
        });

        return { items, search_info };
    }

    private prepareSearchOptions(options: SearchOptions, filters: FilterSearchOptions[], project_id: number): PreparedSearchOptions {
        const formatted_filters = filters && filters.length > 0 ? this.searchRepository.formatFilters(filters) : [];
        const sort_by = options.sort_by ? this.searchRepository.formatSortBy(options.sort_by as string) : [];
        // Drop any caller-supplied project_id / ecotaxa_sample_imported filters: the endpoint always scopes to the path project and to imported samples.
        const safe_filters = formatted_filters.filter(f => f.field !== "project_id" && f.field !== "ecotaxa_sample_imported");
        safe_filters.push({ field: "project_id", operator: "=", value: project_id });
        safe_filters.push({ field: "ecotaxa_sample_imported", operator: "=", value: true });
        return {
            page: options.page,
            limit: options.limit,
            sort_by,
            filter: safe_filters,
        };
    }
}
