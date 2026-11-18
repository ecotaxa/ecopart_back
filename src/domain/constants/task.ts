import { TaskType } from "../entities/task";

export const TASK_CANCELLED_MESSAGE = "Task cancelled";
// Error given to a task found still active when the server starts (see RecoverInterruptedTasks).
export const TASK_INTERRUPTED_MESSAGE = "Task interrupted by a server restart";

// The task types that produce a downloadable archive, counted as exports in the statistics.
export const EXPORT_TASK_TYPES: TaskType[] = [TaskType.Export, TaskType.Export_Backup, TaskType.Export_Raw];
export const IMPORT_TASK_TYPES: TaskType[] = [TaskType.Import, TaskType.Import_Backup, TaskType.Import_CTD, TaskType.Import_EcoTaxa];

// The log of a task that succeeded (DONE) is kept whole for TASK_LOG_RETENTION_DAYS days after its end,
// then reduced to its WARNING lines, or removed when it has none (TaskRepository.purgeExpiredLogs). The
// log of a failed or cancelled task is kept whole: it tells why the task stopped. Servers set the delay
// with TASK_LOG_RETENTION_DAYS in their .env, read in main.ts; this is the value when it is not set.
export const DEFAULT_TASK_LOG_RETENTION_DAYS = 30;
// A log line that reports a degraded result: the only part of the log of a successful task kept past the retention.
export const TASK_LOG_WARNING_LINE = /\bWARNING\b/;
export const TASK_LOG_EXPIRED_MESSAGE = "Task log expired";
