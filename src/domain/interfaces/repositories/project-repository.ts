import { ProjectRequestCreationtModel, ProjectRequestModel, ProjectResponseModel, ProjectUpdateModel } from "../../entities/project";
import { PreparedSearchOptions, SearchResult } from "../../entities/search";

export interface ProjectRepository {
    standardUpdateProject(project_to_update: ProjectUpdateModel): Promise<number>;
    createProject(project: ProjectRequestCreationtModel): Promise<number>;
    getProject(project: ProjectRequestModel): Promise<ProjectResponseModel | null>;
    computeDefaultDepthOffset(instrument: string): number | undefined;
    deleteProject(project: ProjectRequestModel): Promise<number>;
    standardGetProjects(options: PreparedSearchOptions): Promise<SearchResult<ProjectResponseModel>>;
}