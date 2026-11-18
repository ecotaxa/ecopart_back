import { TaskType } from "../entities/task";

export const TASK_CANCELLED_MESSAGE = "Task cancelled";
// Error given to a task found still active when the server starts (see RecoverInterruptedTasks).
export const TASK_INTERRUPTED_MESSAGE = "Task interrupted by a server restart";

// The task types that produce a downloadable archive, counted as exports in the statistics.
export const EXPORT_TASK_TYPES: TaskType[] = [TaskType.Export, TaskType.Export_Backup, TaskType.Export_Raw];
export const IMPORT_TASK_TYPES: TaskType[] = [TaskType.Import, TaskType.Import_Backup, TaskType.Import_CTD, TaskType.Import_EcoTaxa];

// The log of a task that succeeded (DONE) can be read for this many days after its end, then it is
// removed (see TaskRepository.purgeExpiredLogs). The log of a failed or cancelled task is kept: it
// tells why the task stopped.
export const TASK_LOG_RETENTION_DAYS = 30;
export const TASK_LOG_EXPIRED_MESSAGE = "Task log expired";
