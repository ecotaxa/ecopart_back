
import { ProjectDataSource } from "../../data/interfaces/data-sources/project-data-source";
import { ProjectRequestCreationtModel, ProjectRequestModel, ProjectResponseModel } from "../entities/project";
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

}