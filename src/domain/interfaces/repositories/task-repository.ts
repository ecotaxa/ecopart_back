// import { InstrumentModelResponseModel } from "../../entities/instrument_model";
// import { PublicPrivilege } from "../../entities/privilege";
// import { TaskRequestCreationModel, TaskRequestModel, TaskUpdateModel, TaskResponseModel, PublicTaskResponseModel, PublicTaskRequestCreationModel, PrivateTaskRequestModel } from "../../entities/task";
// import { PreparedSearchOptions, SearchResult } from "../../entities/search";

import { PreparedSearchOptions, SearchResult } from "../../entities/search";
import { PublicTaskRequestCreationModel, PrivateTaskRequestModel, TaskResponseModel, TaskStatusResponseModel, TaskTypeResponseModel, PublicTaskRequestModel } from "../../entities/task";
import { UserRequestModel } from "../../entities/user";

export interface TaskRepository {
    getOneTask(task: PrivateTaskRequestModel): Promise<TaskResponseModel | null>;
    startTask(task: PublicTaskRequestModel): Promise<void>;
    finishTask(task: PublicTaskRequestModel): Promise<void>;
    updateTaskProgress(task: PublicTaskRequestModel, progress_pct: number, progress_msg: string): Promise<void>;
    // formatTaskRequestCreationModel(public_task: PublicTaskRequestCreationModel, instrument: InstrumentModelResponseModel): TaskRequestCreationModel;
    // standardUpdateTask(task_to_update: TaskUpdateModel): Promise<number>;
    createTask(task: PublicTaskRequestCreationModel): Promise<number>;
    getTask(task: PrivateTaskRequestModel): Promise<TaskResponseModel | null>;
    deleteTask(task: PrivateTaskRequestModel): Promise<number>;
    standardGetTasks(options: PreparedSearchOptions): Promise<SearchResult<TaskResponseModel>>;
    standardGetTaskType(options: PreparedSearchOptions): Promise<SearchResult<TaskTypeResponseModel>>
    standardGetTaskStatus(options: PreparedSearchOptions): Promise<SearchResult<TaskStatusResponseModel>>;
    getTasksByUser(user: UserRequestModel): Promise<number[]>;
    getLogFileTask(task_id: number): Promise<string>;
    failedTask(task_id: number, error: Error): Promise<void>;
}
