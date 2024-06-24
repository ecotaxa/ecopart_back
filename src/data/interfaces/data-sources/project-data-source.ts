import { ProjectRequestCreationModel, ProjectRequestModel, ProjectUpdateModel, ProjectResponseModel } from "../../../domain/entities/project";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

export interface ProjectDataSource {
    create(project: ProjectRequestCreationModel): Promise<number>;
    getAll(options: PreparedSearchOptions): Promise<SearchResult<ProjectResponseModel>>;
    updateOne(project: ProjectUpdateModel): Promise<number>;
    getOne(project: ProjectRequestModel): Promise<ProjectResponseModel | null>;
    deleteOne(project: ProjectRequestModel): Promise<number>;
}