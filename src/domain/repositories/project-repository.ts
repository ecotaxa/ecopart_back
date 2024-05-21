
import { ProjectDataSource } from "../../data/interfaces/data-sources/project-data-source";
import { ProjectRequestCreationtModel, ProjectRequestModel, ProjectUpdateModel, PublicProjectResponseModel } from "../entities/project";
import { PreparedSearchOptions, SearchResult } from "../entities/search";
import { ProjectRepository } from "../interfaces/repositories/project-repository";

export class ProjectRepositoryImpl implements ProjectRepository {
    projectDataSource: ProjectDataSource

    // TODO move to a search repository
    order_by_allow_params: string[] = ["asc", "desc"]
    filter_operator_allow_params: string[] = ["=", ">", "<", ">=", "<=", "<>", "IN", "LIKE"]

    constructor(projectDataSource: ProjectDataSource) {
        this.projectDataSource = projectDataSource
    }

    async createProject(project: ProjectRequestCreationtModel): Promise<number> {
        const result = await this.projectDataSource.create(project)
        return result;
    }

    async getProject(project: ProjectRequestModel): Promise<PublicProjectResponseModel | null> {
        const result = await this.projectDataSource.getOne(project)
        return result;
    }

    // TODO REFACTOR RE THINK THIS
    computeDefaultDepthOffset(instrument_model: string): number | undefined {
        if (instrument_model === undefined) throw new Error("Instrument is required")
        if (instrument_model.startsWith("UVP5")) return 1.2
        else return undefined
    }

    async deleteProject(project: ProjectRequestModel): Promise<number> {
        const result = await this.projectDataSource.deleteOne(project)
        return result;
    }

    private async updateProject(project: ProjectUpdateModel, params: string[]): Promise<number> {
        const filteredProject: Partial<ProjectUpdateModel> = {};
        const unauthorizedParams: string[] = [];

        // Filter the project object based on authorized parameters
        Object.keys(project).forEach(key => {
            console.log(key)
            if (key === 'project_id') {
                filteredProject[key] = project[key];
            } else if (params.includes(key)) {
                filteredProject[key] = project[key];
            } else {
                unauthorizedParams.push(key);
            }
        });

        // If unauthorized params are found, throw an error
        if (unauthorizedParams.length > 0) {
            throw new Error(`Unauthorized or unexisting parameters : ${unauthorizedParams.join(', ')}`);
        }
        console.log(filteredProject)
        // If there are valid parameters, update the project
        if (Object.keys(filteredProject).length <= 1) {
            throw new Error('Please provide at least one valid parameter to update');
        }
        const updatedProjectCount = await this.projectDataSource.updateOne(filteredProject as ProjectUpdateModel);
        return updatedProjectCount;
    }

    async standardUpdateProject(project: ProjectUpdateModel): Promise<number> {
        const params_restricted = ["project_id", "root_folder_path", "project_title", "project_acronym", "project_description", "project_information", "cruise", "ship", "data_owner_name", "data_owner_email", "operator_name", "operator_email", "chief_scientist_name", "chief_scientist_email", "override_depth_offset", "enable_descent_filter", "privacy_duration", "visible_duration", "public_duration", "instrument_model", "serial_number"]
        const updated_project_nb = await this.updateProject(project, params_restricted)
        return updated_project_nb
    }

    async standardGetProjects(options: PreparedSearchOptions): Promise<SearchResult<PublicProjectResponseModel>> { //TODO
        // Can be filtered by 
        const filter_params_restricted = ["project_id", "root_folder_path", "project_title", "project_acronym", "project_description", "project_information", "cruise", "ship", "data_owner_name", "data_owner_email", "operator_name", "operator_email", "chief_scientist_name", "chief_scientist_email", "override_depth_offset", "enable_descent_filter", "privacy_duration", "visible_duration", "public_duration", "instrument_model", "serial_number", "project_creation_date"]

        // Can be sort_by 
        const sort_param_restricted = ["project_id", "root_folder_path", "project_title", "project_acronym", "project_description", "project_information", "cruise", "ship", "data_owner_name", "data_owner_email", "operator_name", "operator_email", "chief_scientist_name", "chief_scientist_email", "override_depth_offset", "enable_descent_filter", "privacy_duration", "visible_duration", "public_duration", "instrument_model", "serial_number", "project_creation_date"]

        return await this.getProjects(options, filter_params_restricted, sort_param_restricted, this.order_by_allow_params, this.filter_operator_allow_params)
    }

    //TODO MOVE TO SEARCH REPOSITORY
    private async getProjects(options: PreparedSearchOptions, filtering_params: string[], sort_by_params: string[], order_by_params: string[], filter_operator_params: string[]): Promise<SearchResult<PublicProjectResponseModel>> {
        const unauthorizedParams: string[] = [];
        //TODO move to a search repository
        // Filter options.sort_by by sorting params 
        options.sort_by = options.sort_by.filter(sort_by => {
            let is_valid = true;
            if (!sort_by_params.includes(sort_by.sort_by)) {
                unauthorizedParams.push(`Unauthorized sort_by: ${sort_by.sort_by}`);
                is_valid = false;
            }
            if (!order_by_params.includes(sort_by.order_by)) {
                unauthorizedParams.push(`Unauthorized order_by: ${sort_by.order_by}`);
                is_valid = false;
            }
            return is_valid;
        });

        //TODO move to a search repository
        // Filter options.filters by filtering params
        options.filter = options.filter.filter(filter => {
            let is_valid = true;
            if (!filtering_params.includes(filter.field)) {
                unauthorizedParams.push(`Filter field: ${filter.field}`);
                is_valid = false;
            }
            if (!filter_operator_params.includes(filter.operator)) {
                unauthorizedParams.push(`Filter operator: ${filter.operator}`);
                is_valid = false;
            }
            return is_valid;
        });

        //TODO move to a search repository
        if (unauthorizedParams.length > 0) {
            throw new Error(`Unauthorized or unexisting parameters : ${unauthorizedParams.join(', ')}`);
        }

        return await this.projectDataSource.getAll(options);
    }
}