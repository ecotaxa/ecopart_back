import { ProjectRequestCreationtModel, ProjectRequestModel, ProjectUpdateModel, PublicProjectResponseModel } from "../../../domain/entities/project";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

export interface ProjectDataSource {
    create(project: ProjectRequestCreationtModel): Promise<number>;
    getAll(options: PreparedSearchOptions): Promise<SearchResult<PublicProjectResponseModel>>;
    updateOne(project: ProjectUpdateModel): Promise<number>;
    getOne(project: ProjectRequestModel): Promise<PublicProjectResponseModel | null>;
    deleteOne(project: ProjectRequestModel): Promise<number>;
}