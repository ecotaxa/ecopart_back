import path from "path";
import { TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";
import { TASK_CANCELLED_MESSAGE } from "../../constants/task";
import { TaskRepository } from "../../interfaces/repositories/task-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { RecoverInterruptedTasksUseCase } from "../../interfaces/use-cases/task/recover-interrupted-tasks";

export const TASK_INTERRUPTED_MESSAGE = "Task interrupted by a server restart";

// Run once at startup, before any task can be created: a task still active at that point lost its
// work when the server stopped, and nothing would ever move it to a final status. Its own failure
// cleanup never ran either, so what the interrupted work left on disk is removed here.
export class RecoverInterruptedTasks implements RecoverInterruptedTasksUseCase {
    taskRepository: TaskRepository
    projectRepository: ProjectRepository
    sampleRepository: SampleRepository
    DATA_STORAGE_FS_STORAGE: string

    constructor(taskRepository: TaskRepository, projectRepository: ProjectRepository, sampleRepository: SampleRepository, DATA_STORAGE_FS_STORAGE: string) {
        this.taskRepository = taskRepository
        this.projectRepository = projectRepository
        this.sampleRepository = sampleRepository
        this.DATA_STORAGE_FS_STORAGE = DATA_STORAGE_FS_STORAGE
    }

    // Returns the number of tasks moved to a final status. One task that cannot be recovered (its
    // log folder deleted, for instance) is reported and does not block the others or the startup.
    async execute(): Promise<number> {
        const active_tasks = await this.taskRepository.getActiveTasks();
        let recovered = 0;
        for (const task of active_tasks) {
            // A cancellation was requested: honour it. Otherwise the task failed.
            const reason = task.task_status === TasksStatus.Cancelling ? TASK_CANCELLED_MESSAGE : TASK_INTERRUPTED_MESSAGE;
            try {
                await this.taskRepository.failedTask(task.task_id, new Error(reason));
                recovered++;
            } catch (error) {
                console.error(new Date().toISOString(), `Cannot recover interrupted task ${task.task_id}:`, error);
            }
            try {
                await this.removeLeftovers(task);
            } catch (error) {
                console.error(new Date().toISOString(), `Cannot clean up after interrupted task ${task.task_id}:`, error);
            }
        }
        return recovered;
    }

    private async removeLeftovers(task: TaskResponseModel): Promise<void> {
        const messages: string[] = [];

        const task_files = await this.taskRepository.removeTaskWorkFiles(task.task_id);
        if (task_files.length > 0) messages.push(`task folder: ${task_files.join(", ")}`);

        if (task.task_project_id) {
            const temporary_files = await this.projectRepository.removeInterruptedWriteLeftovers(task.task_project_id);
            if (temporary_files.length > 0) messages.push(`unfinished writes in project ${task.task_project_id}: ${temporary_files.join(", ")}`);

            if (task.task_type === TaskType.Import) {
                const samples = await this.removeUncreatedSampleCopies(task, task.task_project_id);
                if (samples.length > 0) messages.push(`copies of the samples not created: ${samples.join(", ")}`);
            }
        }

        for (const message of messages) {
            await this.taskRepository.logMessage(task.task_log_file_path, `Interrupted task cleanup, removed ${message}`).catch(() => undefined);
        }
    }

    // An import stopped before creating its samples leaves their copies in the project storage, and
    // a copied sample is no longer importable. A sample that exists in the database is kept.
    private async removeUncreatedSampleCopies(task: TaskResponseModel, project_id: number): Promise<string[]> {
        const sample_names = this.taskParams(task).samples;
        if (!Array.isArray(sample_names)) return [];

        const uncreated: string[] = [];
        for (const sample_name of sample_names) {
            if (typeof sample_name !== "string") continue;
            const sample = await this.sampleRepository.getSample({ sample_name, project_id });
            if (!sample) uncreated.push(sample_name);
        }
        if (uncreated.length > 0) {
            await this.sampleRepository.deleteSamplesFromImportFolder(path.join(this.DATA_STORAGE_FS_STORAGE, `${project_id}`), uncreated);
        }
        return uncreated;
    }

    // task_params is stored as JSON text
    private taskParams(task: TaskResponseModel): Record<string, unknown> {
        const params: unknown = task.task_params;
        if (typeof params === "string") {
            try {
                return JSON.parse(params);
            } catch {
                return {};
            }
        }
        return (params ?? {}) as Record<string, unknown>;
    }
}
