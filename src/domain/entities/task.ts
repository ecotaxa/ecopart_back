
export enum TasksStatus {
    Pending = "PENDING",
    Running = "RUNNING",
    // Cancellation requested on a running task: the task stops at its next checkpoint.
    Cancelling = "CANCELLING",
    Done = "DONE",
    Error = "ERROR",
    Cancelled = "CANCELLED",
}

export enum TaskType {
    // The binned export (POST /exports/binned).
    Export = "EXPORT",
    Import = "IMPORT",
    Import_Backup = "IMPORT_BACKUP",
    Export_Backup = "EXPORT_BACKUP",
    Import_CTD = "IMPORT_CTD",
    Import_EcoTaxa = "IMPORT_ECO_TAXA",
    Export_Raw = "EXPORT_RAW",
    Regenerate_Pivot = "REGENERATE_PIVOT",
    // Particle counts and extreme areas of the samples imported before they were stored (POST /admin/samples/particle-stats).
    Compute_Particle_Stats = "COMPUTE_PARTICLE_STATS",
}

/* CREATION */
export interface PublicTaskRequestCreationModel {
    task_type: TaskType;
    task_status: TasksStatus;
    task_owner_id: number;
    task_project_id?: number;
    task_params: object;
}
export interface PrivateTaskRequestCreationModel {
    task_type_id: number; //TaskType;
    task_status_id: number; //TasksStatus;
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
    task_creation_utc_date_time: string;
    task_start_utc_date_time?: string;
    task_end_utc_date_time?: string;

    task_progress_pct: number;
    task_progress_msg?: string;
    task_result?: string;
    task_error?: string;
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
    task_creation_utc_date_time: string;
    task_start_utc_date_time?: string;
    task_end_utc_date_time?: string;
    task_log_file_path?: string;

    task_progress_pct: number;
    task_progress_msg?: string;
    task_result?: string;
    task_error?: string;
}

// Restricts a task search to the tasks a user may view: the ones they own, or the ones attached to
// a project they have a privilege on.
export interface TaskVisibilityModel {
    user_id: number;
    project_ids: number[];
}

// API-facing task: the log file path is a server path, the log itself is served by GET /tasks/:id/log.
export type PublicTaskResponseModel = Omit<TaskResponseModel, "task_log_file_path">;

export interface PrivateTaskRequestModel {
    task_id?: number;
    task_type_id?: number;
    task_status_id?: number;
    task_owner_id?: number;
    task_project_id?: number;
    task_params?: object;
    task_log_file_path?: string;
    task_creation_utc_date_time?: string;
    task_start_utc_date_time?: string;
    task_end_utc_date_time?: string;
}

export interface PublicTaskRequestModel extends PrivateTaskRequestModel {
    // for these fields, we will filtred them in the usecase layer
    task_type?: string;
    task_status?: string;
    task_owner?: string;
}
export interface PrivateTaskUpdateModel {
    task_id: number;

    task_type_id?: number;
    task_type?: string;
    task_status_id?: number;
    task_status?: string;
    task_owner_id?: number;
    task_owner?: string;
    task_project_id?: number;
    task_params?: object;
    task_creation_utc_date_time?: string;
    task_start_utc_date_time?: string;
    task_end_utc_date_time?: string;
    task_log_file_path?: string;

    task_progress_pct?: number;
    task_progress_msg?: string;
    task_result?: string;
    task_error?: string;
}