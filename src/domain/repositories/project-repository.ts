
import { ProjectDataSource } from "../../data/interfaces/data-sources/project-data-source";
import { ProjectRequestCreationtModel, ProjectRequestModel, ProjectResponseModel, ProjectUpdateModel } from "../entities/project";
import { ProjectRepository } from "../interfaces/repositories/project-repository";

export class ProjectRepositoryImpl implements ProjectRepository {
    projectDataSource: ProjectDataSource

    // TODO move to a search repository
    // order_by_allow_params: string[] = ["asc", "desc"]
    // filter_operator_allow_params: string[] = ["=", ">", "<", ">=", "<=", "<>", "IN", "LIKE"]

    constructor(projectDataSource: ProjectDataSource) {
        this.projectDataSource = projectDataSource
    }

    async createProject(project: ProjectRequestCreationtModel): Promise<number> {

        const result = await this.projectDataSource.create(project)
        return result;
    }

    async getProject(project: ProjectRequestModel): Promise<ProjectResponseModel | null> {
        const result = await this.projectDataSource.getOne(project)
        return result;
    }

    computeDefaultDepthOffset(instrument: string): number | undefined {
        if (instrument === undefined) throw new Error("Instrument is required")
        if (instrument === "uvp5") return 1.2
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
        const updatedUserCount = await this.projectDataSource.updateOne(filteredProject as ProjectUpdateModel);
        return updatedUserCount;
    }

    async standardUpdateProject(project: ProjectUpdateModel): Promise<number> {
        const params_restricted = ["project_id", "root_folder_path", "project_title", "project_acronym", "project_description", "project_information", "cruise", "ship", "data_owner_name", "data_owner_email", "operator_name", "operator_email", "chief_scientist_name", "chief_scientist_email", "override_depth_offset", "enable_descent_filter", "privacy_duration", "visible_duration", "public_duration", "instrument"]
        const updated_project_nb = await this.updateProject(project, params_restricted)
        return updated_project_nb
    }


}