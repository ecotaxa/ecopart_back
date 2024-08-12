import { TaskResponseModel, PrivateTaskRequestCreationModel, PrivateTaskRequestModel } from "../../../domain/entities/task";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

export interface TaskDataSource {
    create(task: PrivateTaskRequestCreationModel): Promise<number>;
    deleteOne(task: PrivateTaskRequestModel): Promise<number>;
    deleteAll(task: PrivateTaskRequestModel): Promise<number>;
    getAll(options: PreparedSearchOptions): Promise<SearchResult<TaskResponseModel>>;
    getOne(task: PrivateTaskRequestModel): Promise<TaskResponseModel | null>;
}