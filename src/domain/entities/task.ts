
export enum TasksStatus {
    Pending = "PENDING",
    Running = "RUNNING",
    Waiting_for_response = "WAITING_FOR_RESPONSE",
    Done = "DONE",
    Error = "ERROR",
}

export enum TaskType {
    Export = "EXPORT",
    Delete = "DELETE",
    Update = "UPDATE",
    Import = "IMPORT",
    Import_CTD = "IMPORT_CTD",
    Import_EcoTaxa = "IMPORT_ECO_TAXA",
}

export enum TaskAction {
    Start = "START",
    Restart = "RESTART", //create new task with same parameters
    Cancel = "CANCEL",
    Answer = "ANSWER",
}

/* CREATION */
export interface PublicTaskRequestCreationModel {
    task_type_id: TaskType;
    task_status_id: TasksStatus;
    task_owner_id: number; // task owner : string in a public version
    task_project_id?: number;
    task_params: object;
}
export interface PrivateTaskRequestCreationModel {
    task_type_id: TaskType;
    task_status_id: TasksStatus;
    task_owner_id: number; // task owner : string in a public version
    task_project_id?: number;

    task_log_file_path: string;
    task_params: string;
}

/* RESPONSE */
export interface TaskTypeResponseModel {
    task_type_id: number;
    task_type_label: string;
}
export interface TaskStatusResponseModel {
    task_status_id: number;
    task_status_label: string;
}
export interface PrivateTaskResponseModel extends PrivateTaskRequestCreationModel {
    task_id: number;
    task_creation_date: string;
    task_start_date?: string;
    task_end_date?: string;

    task_progress_pct: number;
    task_progress_msg?: string;
    task_result?: string;
    task_error?: string;
    task_question?: string;
    task_reply?: string;
    task_step?: number;
}

export interface TaskResponseModel {
    task_id: number;
    task_type_id: number;
    task_type: string;
    task_status_id: number;
    task_status: string;
    task_owner_id: number;
    task_owner: string;
    task_project_id?: number;
    task_params?: object;
    task_creation_date: string;
    task_start_date?: string;
    task_end_date?: string;
    task_log_file_path?: string;

    task_progress_pct: number;
    task_progress_msg?: string;
    task_result?: string;
    task_error?: string;
    task_question?: string;
    task_reply?: string;
    task_step?: string;
}

/* REQUEST //TODO task_progress_pct: number;
    task_progress_msg?: string;
    task_result?: string;
    task_error?: string;
    task_question?: string;
    task_reply?: string;
    task_step?: number;*/

export interface PrivateTaskRequestModel {
    task_id?: number;
    task_type_id?: TaskType;
    task_status_id?: TasksStatus;
    task_owner_id?: number;
    task_project_id?: number;
    task_params?: object;
    task_log_file_path?: string;
    task_creation_date?: string;
    task_start_date?: string;
    task_end_date?: string;
}

export interface PublicTaskRequestModel extends PrivateTaskRequestModel {
    // for these fields, we will filtred them in the usecase layer
    task_type?: string;
    task_status?: string;
    task_owner?: string;
}

