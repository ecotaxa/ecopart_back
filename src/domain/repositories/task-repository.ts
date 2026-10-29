
import { TaskDataSource } from "../../data/interfaces/data-sources/task-data-source";
import { FsWrapper } from "../../infra/files/fs-wrapper";
import { PreparedSearchOptions, SearchResult } from "../entities/search";
// import { InstrumentModelResponseModel } from "../entities/instrument_model";
// import { PublicPrivilege } from "../entities/privilege";
// import { TaskRequestCreationModel, PrivateTaskRequestModel, TaskUpdateModel, TaskResponseModel, PublicTaskResponseModel, PublicTaskRequestCreationModel } from "../entities/task";
import { PrivateTaskRequestCreationModel, PublicTaskRequestCreationModel, PublicTaskRequestModel, PublicTaskResponseModel, TasksStatus, TaskType, TaskVisibilityModel } from "../entities/task";
import { PrivateTaskRequestModel, TaskResponseModel, TaskStatusResponseModel, TaskTypeResponseModel } from "../entities/task";
import { EXPORT_TASK_TYPES, TASK_CANCELLED_MESSAGE } from "../constants/task";
import { UserRequestModel } from "../entities/user";
// import { PreparedSearchOptions, SearchResult } from "../entities/search";
import { TaskEndListener, TaskRepository } from "../interfaces/repositories/task-repository";
import path from "path";
import fs from "fs/promises";

export class TaskRepositoryImpl implements TaskRepository {
    taskDataSource: TaskDataSource
    fs: FsWrapper
    DATA_STORAGE_FOLDER: string
    taskEndListener?: TaskEndListener

    // TODO move to a search repository
    order_by_allow_params: string[] = ["asc", "desc"]
    filter_operator_allow_params: string[] = ["=", ">", "<", ">=", "<=", "<>", "IN", "LIKE"]
    base_folder = path.join(__dirname, '..', '..', '..');


    constructor(taskDataSource: TaskDataSource, fs: FsWrapper, DATA_STORAGE_FOLDER: string, taskEndListener?: TaskEndListener) {
        this.taskDataSource = taskDataSource
        this.fs = fs
        this.DATA_STORAGE_FOLDER = DATA_STORAGE_FOLDER
        this.taskEndListener = taskEndListener
    }

    async createTask(task: PublicTaskRequestCreationModel): Promise<number> {
        const type_options: PreparedSearchOptions = {
            sort_by: [{ sort_by: "task_type_id", order_by: "asc" }],
            filter: [{ field: "task_type_label", operator: "=", value: task.task_type }],
            page: 1,
            limit: 1
        }
        const status_options: PreparedSearchOptions = {
            sort_by: [{ sort_by: "task_status_id", order_by: "asc" }],
            filter: [{ field: "task_status_label", operator: "=", value: task.task_status }],
            page: 1,
            limit: 1
        }
        // Transform the public task to a private task
        const private_task: PrivateTaskRequestCreationModel = {
            task_type_id: await this.taskDataSource.getAllType(type_options).then(result => {
                if (result.items.length === 0) {
                    throw new Error("Task type not found")
                }
                return result.items[0].task_type_id
            }),
            task_status_id: await this.taskDataSource.getAllStatus(status_options).then(result => {
                if (result.items.length === 0) {
                    throw new Error("Task status not found")
                }
                return result.items[0].task_status_id
            }),
            task_owner_id: task.task_owner_id,
            task_project_id: task.task_project_id,
            task_log_file_path: "",
            task_params: JSON.stringify(task.task_params)
        }
        const result = await this.taskDataSource.create(private_task)

        //create log file based on created task_id
        const log_file_path = path.join(this.base_folder, this.DATA_STORAGE_FOLDER, "tasks", `${result}`, `task_log_${result}.log`)

        //  create log file and log task creation
        try {
            // Ensure the directory exists
            const dir = path.dirname(log_file_path);
            await fs.mkdir(dir, { recursive: true });

            // Create or empty the log file
            await fs.writeFile(log_file_path, "");

            // Write the task creation message
            await this.logMessage(log_file_path, "Task created for " + task.task_type)
            await this.logMessage(log_file_path, "Task params: " + JSON.stringify(task.task_params))
        } catch (err) {
            // if error, failed task and throw an error
            await this.internalFailedTask(result, err)
            throw new Error("Cannot create log file");
        }
        // update task with log file path
        await this.taskDataSource.updateOne({ task_id: result, task_log_file_path: log_file_path })

        return result;
    }

    async startTask(task: PublicTaskRequestModel): Promise<void> {

        const task_to_start = await this.taskDataSource.getOne({ task_id: task.task_id })
        if (!task_to_start) {
            throw new Error("Task not found")
        }

        // Cancelled while still pending: the work must not start.
        if (task_to_start.task_status === TasksStatus.Cancelled) {
            throw new Error(TASK_CANCELLED_MESSAGE)
        }

        // Update the task status to running
        await this.statusManager({ task_id: task_to_start.task_id }, TasksStatus.Running)

        // appendFile to log file that task is running
        await this.logMessage(task_to_start.task_log_file_path, "Task is running")
    }

    async finishTask(task: PublicTaskRequestModel, task_result?: string): Promise<void> {
        const task_to_finish = await this.taskDataSource.getOne({ task_id: task.task_id })
        if (!task_to_finish) {
            throw new Error("Task not found")
        }

        // Update the task status to done
        await this.statusManager({ task_id: task_to_finish.task_id }, TasksStatus.Done)

        // Update the task progress to 100% and add a message
        await this.updateTaskProgress(task, 100, "Task is done sucessfilly")

        // Update the task result if provided
        if (task_result) {
            await this.taskDataSource.updateOne({ task_id: task_to_finish.task_id, task_result: this.withoutServerRoot(task_result) })
        }

        // appendFile to log file that task is done
        await this.logMessage(task_to_finish.task_log_file_path, "Task is done sucessfilly")
    }

    async updateTaskProgress(task: PublicTaskRequestModel, progress_pct: number, progress_msg: string): Promise<void> {
        const task_to_update = await this.ensureTaskExists(task.task_id || 0)

        // Update the task progress
        await this.taskDataSource.updateOne({ task_id: task_to_update.task_id, task_progress_pct: progress_pct, task_progress_msg: progress_msg })

        // appendFile to log file the progress
        await this.logMessage(task_to_update.task_log_file_path, `Task progress: ${progress_pct}% - ${progress_msg}`)
    }

    async ensureTaskExists(task_id: number): Promise<TaskResponseModel> {
        const task_to_update = await this.taskDataSource.getOne({ task_id: task_id })
        if (!task_to_update) {
            throw new Error("Task not found")
        }
        return task_to_update
    }

    async getTask(task: PrivateTaskRequestModel): Promise<TaskResponseModel | null> {
        const result = await this.taskDataSource.getOne(task)
        return result;
    }

    // Only a finished task can be deleted: the work of an unfinished one may still be running, it is
    // cancelled instead. The delete only lands if the status it was decided from is still current.
    // Its files go first, so a failure to remove them leaves the task in place to delete again.
    async deleteTask(task: PrivateTaskRequestModel): Promise<number> {
        for (let attempt = 0; attempt < this.statusUpdateAttempts; attempt++) {
            const task_to_delete = await this.taskDataSource.getOne({ task_id: task.task_id });
            if (!task_to_delete) return 0;
            if (!this.isFinished(task_to_delete.task_status)) {
                throw new Error(`Task ${task_to_delete.task_id} is still ${task_to_delete.task_status}: cancel it before deleting it.`);
            }

            await this.removeTaskFolder(task_to_delete);
            const deleted = await this.taskDataSource.deleteOne({ task_id: task_to_delete.task_id }, task_to_delete.task_status_id);
            if (deleted > 0) return deleted;
        }
        throw new Error("Task status changed concurrently");
    }

    // The task folder holds the log and everything the task wrote (archives, working files). The log
    // path was stored at creation: if the storage folder has moved since, that folder goes too.
    private async removeTaskFolder(task: TaskResponseModel): Promise<void> {
        const folders = new Set([path.join(this.base_folder, this.DATA_STORAGE_FOLDER, "tasks", `${task.task_id}`)]);
        if (task.task_log_file_path) {
            const log_folder = path.dirname(task.task_log_file_path);
            const is_task_folder = path.basename(log_folder) === `${task.task_id}` && path.basename(path.dirname(log_folder)) === "tasks";
            if (is_task_folder) folders.add(log_folder);
            else await fs.rm(task.task_log_file_path, { force: true });
        }
        for (const folder of folders) {
            await fs.rm(folder, { recursive: true, force: true });
        }
    }

    // private async updateTask(task: TaskUpdateModel, params: string[]): Promise<number> {
    //     const filteredTask: Partial<TaskUpdateModel> = {};
    //     const unauthorizedParams: string[] = [];

    //     // Filter the task object based on authorized parameters
    //     Object.keys(task).forEach(key => {
    //         if (key === 'task_id') {
    //             filteredTask[key] = task[key];
    //         } else if (params.includes(key)) {
    //             filteredTask[key] = task[key];
    //         } else {
    //             unauthorizedParams.push(key);
    //         }
    //     });

    //     // If unauthorized params are found, throw an error
    //     if (unauthorizedParams.length > 0) {
    //         throw new Error(`Unauthorized or unexisting parameters : ${unauthorizedParams.join(', ')}`);
    //     }
    //     // If there are valid parameters, update the task
    //     if (Object.keys(filteredTask).length <= 1) {
    //         throw new Error('Please provide at least one valid parameter to update');
    //     }
    //     const updatedTaskCount = await this.taskDataSource.updateOne(filteredTask as TaskUpdateModel);
    //     return updatedTaskCount;
    // }

    // async standardUpdateTask(task: TaskUpdateModel): Promise<number> {
    //     const params_restricted = ["task_id", "root_folder_path", "task_title", "task_acronym", "task_description", "task_information", "cruise", "ship", "data_owner_name", "data_owner_email", "operator_name", "operator_email", "chief_scientist_name", "chief_scientist_email", "override_depth_offset", "enable_descent_filter", "privacy_duration", "visible_duration", "public_duration", "instrument_model", "serial_number"]
    //     const updated_task_nb = await this.updateTask(task, params_restricted)
    //     return updated_task_nb
    // }

    async standardGetTasks(options: PreparedSearchOptions, visible_to?: TaskVisibilityModel): Promise<SearchResult<TaskResponseModel>> {
        // Can be filtered by (task_owner is the computed "First Last (email)" string resolved
        // against the joined user row in the data source).
        const filter_params_restricted = ["task_id", "task_type_id", "task_status_id", "task_owner_id", "task_owner", "task_project_id", "task_creation_utc_date_time", "task_start_utc_date_time", "task_end_utc_date_time"]

        // Can be sort_by
        const sort_param_restricted = ["task_id", "task_type_id", "task_status_id", "task_owner_id", "task_project_id", "task_creation_utc_date_time", "task_start_utc_date_time", "task_end_utc_date_time"]

        return await this.getTasks(options, filter_params_restricted, sort_param_restricted, this.order_by_allow_params, this.filter_operator_allow_params, visible_to)
    }

    async standardGetTaskType(options: PreparedSearchOptions): Promise<SearchResult<TaskTypeResponseModel>> {
        // Can be filtered by 
        const filter_params_restricted = ["task_type_id", "task_type_label"]

        // Can be sort_by 
        const sort_param_restricted = ["task_type_id", "task_type_label"]

        return await this.getTasksType(options, filter_params_restricted, sort_param_restricted, this.order_by_allow_params, this.filter_operator_allow_params)
    }

    private async getTasksType(options: PreparedSearchOptions, filtering_params: string[], sort_by_params: string[], order_by_params: string[], filter_operator_params: string[]): Promise<SearchResult<TaskTypeResponseModel>> {
        const unauthorizedParams: string[] = [];
        //TODO move to a search repository
        // Filter options.sort_by by sorting params 
        options.sort_by = options.sort_by.filter(sort_by => {
            let is_valid = true;
            if (!sort_by_params.includes(sort_by.sort_by)) {
                unauthorizedParams.push(`Unauthorized sort_by: ${sort_by.sort_by}`);
                is_valid = false;
            }
            if (!order_by_params.includes(sort_by.order_by)) {
                unauthorizedParams.push(`Unauthorized order_by: ${sort_by.order_by}`);
                is_valid = false;
            }
            return is_valid;
        });

        //TODO move to a search repository
        // Filter options.filters by filtering params
        options.filter = options.filter.filter(filter => {
            let is_valid = true;
            if (!filtering_params.includes(filter.field)) {
                unauthorizedParams.push(`Filter field: ${filter.field}`);
                is_valid = false;
            }
            if (!filter_operator_params.includes(filter.operator)) {
                unauthorizedParams.push(`Filter operator: ${filter.operator}`);
                is_valid = false;
            }
            return is_valid;
        });

        //TODO move to a search repository
        if (unauthorizedParams.length > 0) {
            throw new Error(`Unauthorized or unexisting parameters : ${unauthorizedParams.join(', ')}`);
        }

        return await this.taskDataSource.getAllType(options);
    }

    async standardGetTaskStatus(options: PreparedSearchOptions): Promise<SearchResult<TaskStatusResponseModel>> {
        // Can be filtered by 
        const filter_params_restricted = ["task_status_id", "task_status_label"]

        // Can be sort_by 
        const sort_param_restricted = ["task_status_id", "task_status_label"]

        return await this.getTasksStatus(options, filter_params_restricted, sort_param_restricted, this.order_by_allow_params, this.filter_operator_allow_params)
    }

    private async getTasksStatus(options: PreparedSearchOptions, filtering_params: string[], sort_by_params: string[], order_by_params: string[], filter_operator_params: string[]): Promise<SearchResult<TaskStatusResponseModel>> {
        const unauthorizedParams: string[] = [];
        //TODO move to a search repository
        // Filter options.sort_by by sorting params 
        options.sort_by = options.sort_by.filter(sort_by => {
            let is_valid = true;
            if (!sort_by_params.includes(sort_by.sort_by)) {
                unauthorizedParams.push(`Unauthorized sort_by: ${sort_by.sort_by}`);
                is_valid = false;
            }
            if (!order_by_params.includes(sort_by.order_by)) {
                unauthorizedParams.push(`Unauthorized order_by: ${sort_by.order_by}`);
                is_valid = false;
            }
            return is_valid;
        });

        //TODO move to a search repository
        // Filter options.filters by filtering params
        options.filter = options.filter.filter(filter => {
            let is_valid = true;
            if (!filtering_params.includes(filter.field)) {
                unauthorizedParams.push(`Filter field: ${filter.field}`);
                is_valid = false;
            }
            if (!filter_operator_params.includes(filter.operator)) {
                unauthorizedParams.push(`Filter operator: ${filter.operator}`);
                is_valid = false;
            }
            return is_valid;
        });

        //TODO move to a search repository
        if (unauthorizedParams.length > 0) {
            throw new Error(`Unauthorized or unexisting parameters : ${unauthorizedParams.join(', ')}`);
        }

        return await this.taskDataSource.getAllStatus(options);
    }
    //TODO MOVE TO SEARCH REPOSITORY
    private async getTasks(options: PreparedSearchOptions, filtering_params: string[], sort_by_params: string[], order_by_params: string[], filter_operator_params: string[], visible_to?: TaskVisibilityModel): Promise<SearchResult<TaskResponseModel>> {
        const unauthorizedParams: string[] = [];
        //TODO move to a search repository
        // Filter options.sort_by by sorting params 
        options.sort_by = options.sort_by.filter(sort_by => {
            let is_valid = true;
            if (!sort_by_params.includes(sort_by.sort_by)) {
                unauthorizedParams.push(`Unauthorized sort_by: ${sort_by.sort_by}`);
                is_valid = false;
            }
            if (!order_by_params.includes(sort_by.order_by)) {
                unauthorizedParams.push(`Unauthorized order_by: ${sort_by.order_by}`);
                is_valid = false;
            }
            return is_valid;
        });

        //TODO move to a search repository
        // Filter options.filters by filtering params
        options.filter = options.filter.filter(filter => {
            let is_valid = true;
            if (!filtering_params.includes(filter.field)) {
                unauthorizedParams.push(`Filter field: ${filter.field}`);
                is_valid = false;
            }
            if (!filter_operator_params.includes(filter.operator)) {
                unauthorizedParams.push(`Filter operator: ${filter.operator}`);
                is_valid = false;
            }
            return is_valid;
        });

        //TODO move to a search repository
        if (unauthorizedParams.length > 0) {
            throw new Error(`Unauthorized or unexisting parameters : ${unauthorizedParams.join(', ')}`);
        }

        return await this.taskDataSource.getAll(options, visible_to);
    }
    // Get One Task
    async getOneTask(task: PrivateTaskRequestModel): Promise<TaskResponseModel | null> {
        return await this.taskDataSource.getOne(task);
    }
    async getTasksByUser(user: UserRequestModel): Promise<number[]> {
        return await this.taskDataSource.getTasksByUser(user);
    }

    toPublicTask(task: TaskResponseModel): PublicTaskResponseModel {
        const public_task: Partial<TaskResponseModel> = { ...task };
        delete public_task.task_log_file_path;
        return public_task as PublicTaskResponseModel;
    }

    async getLogFileTask(task_id: number): Promise<string> {
        // get task from task.taskid
        const task = await this.taskDataSource.getOne({ task_id: task_id })
        // get log file path from task
        const task_log_file_path = task?.task_log_file_path
        // if no log file path found, throw an error
        if (!task_log_file_path) {
            throw new Error("No log file path found for this task")
        }
        // read log file
        try {
            const data = await this.fs.readFile(task_log_file_path, { encoding: 'utf8' });
            return data;
        } catch (err) {
            // if error, throw an error
            throw new Error("Cannot read log file");
        }
    }

    async getZipFilePath(task_id: number): Promise<string> {
        // ensure folder exists for this task
        const zipPath = path.join(this.base_folder, this.DATA_STORAGE_FOLDER, "tasks", `${task_id}`)

        // return the first file that have extention .zip in the folder
        const files = await fs.readdir(zipPath)
        const zipFile = files.find(file => file.endsWith(".zip"))
        if (!zipFile) {
            throw new Error(`No file found for task ${task_id}`)
        }
        return path.join(zipPath, zipFile)
    }

    // Everything a task wrote in its own folder except its log: the working folder and the temporary
    // or complete archive of an export. Returns the removed entry names.
    async removeTaskWorkFiles(task_id: number): Promise<string[]> {
        const task_folder = path.join(this.base_folder, this.DATA_STORAGE_FOLDER, "tasks", `${task_id}`)
        let entries: string[]
        try {
            entries = await fs.readdir(task_folder)
        } catch {
            return []
        }
        const removed = entries.filter(entry => entry !== `task_log_${task_id}.log`)
        for (const entry of removed) {
            await fs.rm(path.join(task_folder, entry), { recursive: true, force: true })
        }
        return removed
    }

    async failedTask(task_id: number, error: Error): Promise<void> {
        const task = await this.getTask({ task_id: task_id })
        if (!task) throw new Error("Task not found")

        // Cancelled before it started: already final, nothing ran.
        if (task.task_status === TasksStatus.Cancelled) return;

        // Stopped at a checkpoint after a cancellation request, its own cleanup already done.
        if (task.task_status === TasksStatus.Cancelling && error.message === TASK_CANCELLED_MESSAGE) {
            await this.statusManager({ task_id: task_id }, TasksStatus.Cancelled);
            await this.logMessage(task.task_log_file_path, "Task cancelled");
            return;
        }

        // log error in log file. Best effort: a task whose log cannot be written must still end in
        // ERROR, otherwise it stays active forever (and blocks the startup recovery).
        await this.logMessage(task.task_log_file_path, `Task failed with error: ${error.message}`).catch(() => undefined);

        // internally failed task
        await this.internalFailedTask(task_id, error)
    }

    async internalFailedTask(task_id: number, error: Error): Promise<void> {
        // Update the task error message
        await this.taskDataSource.updateOne({ task_id: task_id, task_error: this.withoutServerRoot(error.message) })

        // Update the task status to error
        await this.statusManager({
            task_id: task_id
        }, TasksStatus.Error)
    }

    async logMessage(task_log_file_path: string | undefined, message: string): Promise<void> {
        if (!task_log_file_path) throw new Error("No log file path found for this task")
        const log_file_path = task_log_file_path;
        if (log_file_path) await this.fs.appendFile(log_file_path, new Date().toISOString() + " " + this.withoutServerRoot(message) + "\n");
    }

    // The log, the error and the result of a task are read by its owner: every path they quote, system
    // errors included, is shown relative to the application root, never as a server path.
    private withoutServerRoot(message: string): string {
        return message.split(this.base_folder + path.sep).join("");
    }
    // Define allowed transitions between statuses
    private allowedTransitions: { [key in TasksStatus]: TasksStatus[] } = {
        [TasksStatus.Pending]: [TasksStatus.Running, TasksStatus.Error, TasksStatus.Cancelled],
        [TasksStatus.Running]: [TasksStatus.Done, TasksStatus.Error, TasksStatus.Cancelling],
        // A task that reaches its end before its next checkpoint still completes, or fails.
        [TasksStatus.Cancelling]: [TasksStatus.Cancelled, TasksStatus.Done, TasksStatus.Error],
        [TasksStatus.Done]: [],
        [TasksStatus.Error]: [],
        [TasksStatus.Cancelled]: [],
    };

    // Statuses of a task whose work may still be running.
    private activeStatuses: TasksStatus[] = [TasksStatus.Pending, TasksStatus.Running, TasksStatus.Cancelling];

    // A finished task never changes status any more. An unknown status is not finished.
    private isFinished(status: string): boolean {
        return this.allowedTransitions[status as TasksStatus]?.length === 0;
    }

    // A status write only lands if the status it was decided from is still current. A concurrent
    // change (a cancellation racing the end of the task) is re-read and decided again.
    private statusUpdateAttempts = 3;

    async statusManager(task: PublicTaskRequestModel, status: TasksStatus): Promise<void> {
        for (let attempt = 0; attempt < this.statusUpdateAttempts; attempt++) {
            const task_to_update = await this.taskDataSource.getOne({ task_id: task.task_id });

            // Task not found
            if (!task_to_update) {
                throw new Error("Task not found");
            }

            // Check if the task is already in the requested status
            if (task_to_update.task_status === status) {
                throw new Error("Task is already in this status");
            }

            if (await this.transition(task_to_update, status)) return;
        }
        throw new Error("Task status changed concurrently");
    }

    // Applies an allowed transition from the task's current status. Returns false when that status
    // changed in the meantime, in which case nothing was written.
    private async transition(task: TaskResponseModel, status: TasksStatus): Promise<boolean> {
        const allowedStatuses = this.allowedTransitions[task.task_status as TasksStatus] ?? [];
        if (!allowedStatuses.includes(status)) {
            throw new Error(`Cannot change status from ${task.task_status} to ${status}`);
        }

        const [transition_status_id] = await this.getStatusIds([status]);

        // Stamp start/end timestamps as ISO 8601 UTC when entering Running or a final status so
        // consumers see when the task ran.
        const update: { task_id: number; task_status_id: number; task_start_utc_date_time?: string; task_end_utc_date_time?: string } = {
            task_id: task.task_id,
            task_status_id: transition_status_id,
        };
        const now_iso = new Date().toISOString();
        if (status === TasksStatus.Running) update.task_start_utc_date_time = now_iso;
        if (status === TasksStatus.Done || status === TasksStatus.Error || status === TasksStatus.Cancelled) update.task_end_utc_date_time = now_iso;
        const updated = await this.taskDataSource.updateOne(update, task.task_status_id);
        if (updated === 0) return false;

        // Logging task status update in the log file
        await this.logMessage(task.task_log_file_path, `Task status updated from ${task.task_status} to ${status}`);

        if (this.isFinished(status)) await this.notifyTaskEnded(task, status);
        return true;
    }

    // Best effort: the task has ended whatever happens to its notification.
    private async notifyTaskEnded(task: TaskResponseModel, status: TasksStatus): Promise<void> {
        if (!this.taskEndListener) return;
        try {
            await this.taskEndListener.onTaskEnded(task, status);
        } catch (err) {
            console.log(new Date().toISOString(), `Cannot notify the end of task ${task.task_id}`, err);
        }
    }

    // A pending task is cancelled at once, its work has not started. A running task is marked
    // CANCELLING: its work stops at the next throwIfCancelled checkpoint, cleans up what it produced,
    // and failedTask then moves it to CANCELLED.
    async cancelTask(task_id: number): Promise<void> {
        for (let attempt = 0; attempt < this.statusUpdateAttempts; attempt++) {
            const task = await this.ensureTaskExists(task_id);
            let target: TasksStatus;
            if (task.task_status === TasksStatus.Pending) target = TasksStatus.Cancelled;
            else if (task.task_status === TasksStatus.Running) target = TasksStatus.Cancelling;
            else throw new Error("Task cannot be cancelled");

            if (await this.transition(task, target)) {
                await this.logMessage(task.task_log_file_path, target === TasksStatus.Cancelled
                    ? "Task cancelled before it started"
                    : "Cancellation requested, the task stops at its next checkpoint");
                return;
            }
        }
        throw new Error("Task status changed concurrently");
    }

    // Checkpoint called by a running task between its steps.
    async throwIfCancelled(task_id: number): Promise<void> {
        const task = await this.ensureTaskExists(task_id);
        if (task.task_status === TasksStatus.Cancelling || task.task_status === TasksStatus.Cancelled) {
            throw new Error(TASK_CANCELLED_MESSAGE);
        }
    }

    // Checks and creations run one at a time (single server process), so two requests cannot both
    // see "no active task" and both create one. Returns null, creating nothing, when a task of one
    // of the conflicting types is still active on the project.
    private creationQueue: Promise<unknown> = Promise.resolve();

    async createTaskUnlessActive(task: PublicTaskRequestCreationModel, conflicting_types: TaskType[]): Promise<number | null> {
        const result = this.creationQueue.then(async () => {
            if (task.task_project_id !== undefined && await this.hasActiveTask(task.task_project_id, conflicting_types)) return null;
            return await this.createTask(task);
        });
        this.creationQueue = result.catch(() => undefined);
        return result;
    }

    async hasActiveTask(project_id: number, task_types: TaskType[]): Promise<boolean> {
        const result = await this.taskDataSource.getAll({
            filter: [
                { field: "task_project_id", operator: "=", value: project_id },
                { field: "task_type_id", operator: "IN", value: await this.getTypeIds(task_types) },
                { field: "task_status_id", operator: "IN", value: await this.getStatusIds(this.activeStatuses) },
            ],
            sort_by: [],
            page: 1,
            limit: 1
        });
        return result.total > 0;
    }

    async countExportTasks(project_id: number): Promise<number> {
        const export_labels: string[] = EXPORT_TASK_TYPES;
        return (await this.taskDataSource.countTasksByType(project_id))
            .reduce((total, { label, count }) => export_labels.includes(label) ? total + count : total, 0);
    }

    async getActiveTasks(): Promise<TaskResponseModel[]> {
        const status_ids = await this.getStatusIds(this.activeStatuses);
        const limit = 500;
        const tasks: TaskResponseModel[] = [];
        for (let page = 1; ; page++) {
            const result = await this.taskDataSource.getAll({
                filter: [{ field: "task_status_id", operator: "IN", value: status_ids }],
                sort_by: [{ sort_by: "task_id", order_by: "asc" }],
                page,
                limit
            });
            tasks.push(...result.items);
            if (result.items.length < limit) return tasks;
        }
    }

    private async getStatusIds(statuses: TasksStatus[]): Promise<number[]> {
        const result = await this.taskDataSource.getAllStatus({
            sort_by: [{ sort_by: "task_status_id", order_by: "asc" }],
            filter: [{ field: "task_status_label", operator: "IN", value: statuses }],
            page: 1,
            limit: statuses.length
        });
        return statuses.map(status => {
            const found = result.items.find(item => item.task_status_label === status);
            if (!found) throw new Error("Task status not found");
            return found.task_status_id;
        });
    }

    private async getTypeIds(types: TaskType[]): Promise<number[]> {
        const result = await this.taskDataSource.getAllType({
            sort_by: [{ sort_by: "task_type_id", order_by: "asc" }],
            filter: [{ field: "task_type_label", operator: "IN", value: types }],
            page: 1,
            limit: types.length
        });
        return types.map(type => {
            const found = result.items.find(item => item.task_type_label === type);
            if (!found) throw new Error("Task type not found");
            return found.task_type_id;
        });
    }

    async updateTaskResult(task: PublicTaskRequestModel, task_result: string): Promise<void> {
        const task_to_update = await this.taskDataSource.getOne({ task_id: task.task_id });
        if (!task_to_update) {
            throw new Error("Task not found");
        }
        await this.taskDataSource.updateOne({
            task_id: task_to_update.task_id, task_result: this.withoutServerRoot(task_result)
        })
    }
}