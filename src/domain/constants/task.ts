import { TaskType } from "../entities/task";

export const TASK_CANCELLED_MESSAGE = "Task cancelled";

// The task types that produce a downloadable archive, counted as exports in the statistics.
export const EXPORT_TASK_TYPES: TaskType[] = [TaskType.Export, TaskType.Export_Backup, TaskType.Export_Raw];
export const IMPORT_TASK_TYPES: TaskType[] = [TaskType.Import, TaskType.Import_Backup, TaskType.Import_CTD, TaskType.Import_EcoTaxa];
