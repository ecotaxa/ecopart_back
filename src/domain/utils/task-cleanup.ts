import { TASK_CANCELLED_MESSAGE } from "../constants/task";

// Prefix of the task log lines written while a failed or cancelled task removes what it produced.
export function cleanupLogPrefix(error: unknown): string {
    return (error as Error)?.message === TASK_CANCELLED_MESSAGE ? "Cleanup after cancellation" : "Cleanup after failure";
}
