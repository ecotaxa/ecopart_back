// import { InstrumentModelResponseModel } from "../../entities/instrument_model";
// import { PublicPrivilege } from "../../entities/privilege";
// import { TaskRequestCreationModel, TaskRequestModel, TaskUpdateModel, TaskResponseModel, PublicTaskResponseModel, PublicTaskRequestCreationModel, PrivateTaskRequestModel } from "../../entities/task";
// import { PreparedSearchOptions, SearchResult } from "../../entities/search";

import { PreparedSearchOptions, SearchResult } from "../../entities/search";
import { PublicTaskRequestCreationModel, PrivateTaskRequestModel, TaskResponseModel, TaskStatusResponseModel, TaskTypeResponseModel, PublicTaskRequestModel, PublicTaskResponseModel, TaskType, TaskVisibilityModel } from "../../entities/task";
import { UserRequestModel } from "../../entities/user";

// Appends one line to a task log file (see TaskRepository.logMessage).
export type TaskLogger = (message: string) => Promise<void>;

export interface TaskRepository {
    getOneTask(task: PrivateTaskRequestModel): Promise<TaskResponseModel | null>;
    startTask(task: PublicTaskRequestModel): Promise<void>;
    finishTask(task: PublicTaskRequestModel, task_result?: string): Promise<void>;
    updateTaskProgress(task: PublicTaskRequestModel, progress_pct: number, progress_msg: string): Promise<void>;
    // formatTaskRequestCreationModel(public_task: PublicTaskRequestCreationModel, instrument: InstrumentModelResponseModel): TaskRequestCreationModel;
    // standardUpdateTask(task_to_update: TaskUpdateModel): Promise<number>;
    createTask(task: PublicTaskRequestCreationModel): Promise<number>;
    getTask(task: PrivateTaskRequestModel): Promise<TaskResponseModel | null>;
    deleteTask(task: PrivateTaskRequestModel): Promise<number>;
    standardGetTasks(options: PreparedSearchOptions, visible_to?: TaskVisibilityModel): Promise<SearchResult<TaskResponseModel>>;
    standardGetTaskType(options: PreparedSearchOptions): Promise<SearchResult<TaskTypeResponseModel>>
    standardGetTaskStatus(options: PreparedSearchOptions): Promise<SearchResult<TaskStatusResponseModel>>;
    getTasksByUser(user: UserRequestModel): Promise<number[]>;
    toPublicTask(task: TaskResponseModel): PublicTaskResponseModel;
    cancelTask(task_id: number): Promise<void>;
    throwIfCancelled(task_id: number): Promise<void>;
    createTaskUnlessActive(task: PublicTaskRequestCreationModel, conflicting_types: TaskType[]): Promise<number | null>;
    getActiveTasks(): Promise<TaskResponseModel[]>;
    removeTaskWorkFiles(task_id: number): Promise<string[]>;
    getLogFileTask(task_id: number): Promise<string>;
    getZipFilePath(task_id: number): Promise<string>;
    failedTask(task_id: number, error: Error): Promise<void>;
    logMessage(task_log_file_path: string | undefined, message: string): Promise<void>;
    updateTaskResult(task: PublicTaskRequestModel, task_result: string): Promise<void>;
}
