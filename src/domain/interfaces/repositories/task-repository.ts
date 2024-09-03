// import { InstrumentModelResponseModel } from "../../entities/instrument_model";
// import { PublicPrivilege } from "../../entities/privilege";
// import { TaskRequestCreationModel, TaskRequestModel, TaskUpdateModel, TaskResponseModel, PublicTaskResponseModel, PublicTaskRequestCreationModel, PrivateTaskRequestModel } from "../../entities/task";
// import { PreparedSearchOptions, SearchResult } from "../../entities/search";

import { PreparedSearchOptions, SearchResult } from "../../entities/search";
import { PrivateTaskRequestModel, TaskResponseModel, TaskStatusResponseModel, TaskTypeResponseModel } from "../../entities/task";
import { UserRequestModel } from "../../entities/user";

export interface TaskRepository {
    getOneTask(task: PrivateTaskRequestModel): Promise<TaskResponseModel | null>
    // formatTaskRequestCreationModel(public_task: PublicTaskRequestCreationModel, instrument: InstrumentModelResponseModel): TaskRequestCreationModel;
    // standardUpdateTask(task_to_update: TaskUpdateModel): Promise<number>;
    // createTask(task: TaskRequestCreationModel): Promise<number>;
    getTask(task: PrivateTaskRequestModel): Promise<TaskResponseModel | null>;
    deleteTask(task: PrivateTaskRequestModel): Promise<number>;
    standardGetTasks(options: PreparedSearchOptions): Promise<SearchResult<TaskResponseModel>>;
    standardGetTaskType(options: PreparedSearchOptions): Promise<SearchResult<TaskTypeResponseModel>>
    standardGetTaskStatus(options: PreparedSearchOptions): Promise<SearchResult<TaskStatusResponseModel>>;
    getTasksByUser(user: UserRequestModel): Promise<number[]>;
    getLogFileTask(task_id: number): Promise<string>
}
