import { TaskResponseModel, PrivateTaskRequestCreationModel, PrivateTaskRequestModel, TaskTypeResponseModel, TaskStatusResponseModel, PrivateTaskUpdateModel, TaskVisibilityModel } from "../../../domain/entities/task";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";
import { UserRequestModel } from "../../../domain/entities/user";

export interface TaskDataSource {
    create(task: PrivateTaskRequestCreationModel): Promise<number>;
    deleteOne(task: PrivateTaskRequestModel, expected_status_id?: number): Promise<number>;
    deleteAll(task: PrivateTaskRequestModel): Promise<number>;
    getAll(options: PreparedSearchOptions, visible_to?: TaskVisibilityModel): Promise<SearchResult<TaskResponseModel>>;
    getTasksByUser(user: UserRequestModel): Promise<number[]>
    getOne(task: PrivateTaskRequestModel): Promise<TaskResponseModel | null>;
    getAllType(options: PreparedSearchOptions): Promise<SearchResult<TaskTypeResponseModel>>
    getAllStatus(options: PreparedSearchOptions): Promise<SearchResult<TaskStatusResponseModel>>
    updateOne(task: PrivateTaskUpdateModel, expected_status_id?: number): Promise<number>
}