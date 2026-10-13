import path from "path";
import * as fsPromises from "fs/promises";

import { TaskResponseModel } from "../../entities/task";
import { TaskRepository } from "../../interfaces/repositories/task-repository";
import { cleanupLogPrefix } from "../../utils/task-cleanup";

// The working folder is the only thing a failed or cancelled export leaves behind: the task created
// it, it is named after the task, and it holds nothing but copies. The archive needs no cleaning
// because zipFolder writes to a temporary file and renames only on success. The task folder itself
// is kept, it holds the log failedTask is about to write to. The outcome is logged either way.
export async function removeExportWorkFolder(taskRepository: TaskRepository, task: TaskResponseModel, work_folder: string, error: unknown): Promise<void> {
    const prefix = cleanupLogPrefix(error);
    const folder_name = `${path.basename(work_folder)}/`;
    let message: string;
    try {
        await fsPromises.rm(work_folder, { recursive: true, force: true });
        message = `removed the working folder ${folder_name} of the task folder`;
    } catch (cleanup_error) {
        // Never mask the original failure: report and move on.
        message = `removal of the working folder ${folder_name} failed, files may remain in the task folder : ${(cleanup_error as Error).message}`;
    }
    await taskRepository.logMessage(task.task_log_file_path, `${prefix} : ${message}`).catch(() => undefined);
}
