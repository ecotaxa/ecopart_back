// import { UserRequestCreationtModel, UserRequestModel, UserUpdateModel, UserResponseModel } from "../../../domain/entities/user";
// import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";
import { ProjectRequestCreationtModel, ProjectRequestModel, ProjectResponseModel, ProjectUpdateModel } from "../../../domain/entities/project";

export interface ProjectDataSource {
    create(project: ProjectRequestCreationtModel): Promise<number>;
    // getAll(options: PreparedSearchOptions): Promise<SearchResult>;
    updateOne(project: ProjectUpdateModel): Promise<number>;
    getOne(project: ProjectRequestModel): Promise<ProjectResponseModel | null>;
    deleteOne(project: ProjectRequestModel): Promise<number>;
}