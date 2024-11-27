
import path from "path";
import { TaskDataSource } from "../../data/interfaces/data-sources/task-data-source";
import { FsWrapper } from "../../infra/files/fs-wrapper";
import { PreparedSearchOptions, SearchResult } from "../entities/search";
// import { InstrumentModelResponseModel } from "../entities/instrument_model";
// import { PublicPrivilege } from "../entities/privilege";
// import { TaskRequestCreationModel, PrivateTaskRequestModel, TaskUpdateModel, TaskResponseModel, PublicTaskResponseModel, PublicTaskRequestCreationModel } from "../entities/task";
import { PrivateTaskRequestCreationModel, PublicTaskRequestCreationModel, PublicTaskRequestModel, TasksStatus } from "../entities/task";
import { PrivateTaskRequestModel, TaskResponseModel, TaskStatusResponseModel, TaskTypeResponseModel } from "../entities/task";
import { UserRequestModel } from "../entities/user";
// import { PreparedSearchOptions, SearchResult } from "../entities/search";
import { TaskRepository } from "../interfaces/repositories/task-repository";

export class TaskRepositoryImpl implements TaskRepository {
    taskDataSource: TaskDataSource
    fs: FsWrapper
    DATA_STORAGE_FOLDER: string

    // TODO move to a search repository
    order_by_allow_params: string[] = ["asc", "desc"]
    filter_operator_allow_params: string[] = ["=", ">", "<", ">=", "<=", "<>", "IN", "LIKE"]
    base_folder = path.join(__dirname, '..', '..', '..');


    constructor(taskDataSource: TaskDataSource, fs: FsWrapper, DATA_STORAGE_FOLDER: string) {
        this.taskDataSource = taskDataSource
        this.fs = fs
        this.DATA_STORAGE_FOLDER = DATA_STORAGE_FOLDER
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
        const log_file_path = path.join(this.base_folder, this.DATA_STORAGE_FOLDER, "tasks_log", `task_${result}.log`)

        //  create log file
        try {
            await this.logMessage(log_file_path, "Task created for " + task.task_type)
            await this.logMessage(log_file_path, "Task params: " + JSON.stringify(task.task_params))
        } catch (err) {
            console.log(err);
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

        // Update the task status to running
        await this.statusManager({ task_id: task_to_start.task_id }, TasksStatus.Running)

        // appendFile to log file that task is running
        await this.logMessage(task_to_start.task_log_file_path, "Task is running")
    }

    async finishTask(task: PublicTaskRequestModel): Promise<void> {
        const task_to_finish = await this.taskDataSource.getOne({ task_id: task.task_id })
        if (!task_to_finish) {
            throw new Error("Task not found")
        }

        // Update the task status to done
        await this.statusManager({ task_id: task_to_finish.task_id }, TasksStatus.Done)

        // Update the task progress to 100% and add a message
        await this.updateTaskProgress(task, 100, "Task is done sucessfilly")

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

    async deleteTask(task: PrivateTaskRequestModel): Promise<number> {
        const result = await this.taskDataSource.deleteOne(task)
        return result;
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

    async standardGetTasks(options: PreparedSearchOptions): Promise<SearchResult<TaskResponseModel>> {
        // Can be filtered by 
        const filter_params_restricted = ["task_id", "task_type_id", "task_status_id", "task_owner_id", "task_project_id", "task_log_file_path", "task_creation_date", "task_start_date", "task_end_date"]

        // Can be sort_by 
        const sort_param_restricted = ["task_id", "task_type_id", "task_status_id", "task_owner_id", "task_project_id", "task_log_file_path", "task_creation_date", "task_start_date", "task_end_date"]

        return await this.getTasks(options, filter_params_restricted, sort_param_restricted, this.order_by_allow_params, this.filter_operator_allow_params)
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
    private async getTasks(options: PreparedSearchOptions, filtering_params: string[], sort_by_params: string[], order_by_params: string[], filter_operator_params: string[]): Promise<SearchResult<TaskResponseModel>> {
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

        return await this.taskDataSource.getAll(options);
    }
    // Get One Task
    async getOneTask(task: PrivateTaskRequestModel): Promise<TaskResponseModel | null> {
        return await this.taskDataSource.getOne(task);
    }
    async getTasksByUser(user: UserRequestModel): Promise<number[]> {
        return await this.taskDataSource.getTasksByUser(user);
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
            console.log(err);
            throw new Error("Cannot read log file");
        }
    }

    async failedTask(task_id: number, error: Error): Promise<void> {
        this.getTask({ task_id: task_id }).then(async task => {
            if (!task) throw new Error("Task not found")

            // log error in log file
            await this.logMessage(task.task_log_file_path, `Task failed with error: ${error.message}`);

            // Update the task error message
            await this.taskDataSource.updateOne({ task_id: task_id, task_error: error.message })

            // Update the task status to error
            await this.statusManager({
                task_id: task_id
            }, TasksStatus.Error)

        })
    }

    async logMessage(task_log_file_path: string | undefined, message: string): Promise<void> {
        if (!task_log_file_path) throw new Error("No log file path found for this task")
        const log_file_path = task_log_file_path;
        if (log_file_path) await this.fs.appendFile(log_file_path, new Date().toISOString() + " " + message + "\n");
    }
    // Define allowed transitions between statuses
    private allowedTransitions: { [key in TasksStatus]: TasksStatus[] } = {
        [TasksStatus.Pending]: [TasksStatus.Running],
        [TasksStatus.Running]: [TasksStatus.Waiting_for_response, TasksStatus.Done, TasksStatus.Error],
        [TasksStatus.Waiting_for_response]: [TasksStatus.Running],
        [TasksStatus.Done]: [],
        [TasksStatus.Error]: [],
    };

    async statusManager(task: PublicTaskRequestModel, status: TasksStatus): Promise<void> {
        // Retrieve the task to update
        const task_to_update = await this.taskDataSource.getOne({ task_id: task.task_id });

        // Task not found
        if (!task_to_update) {
            throw new Error("Task not found");
        }

        // Check if the task is already in the requested status
        if (task_to_update.task_status === status) {
            throw new Error("Task is already in this status");
        }

        // Check if the transition to the requested status is allowed
        const allowedStatuses = this.allowedTransitions[task_to_update.task_status as TasksStatus];
        if (!allowedStatuses.includes(status)) {
            throw new Error(`Cannot change status from ${task_to_update.task_status} to ${status}`);
        }

        // Retrieve the status id of the requested status
        const transition_status_id = await this.taskDataSource.getAllStatus({
            sort_by: [{ sort_by: "task_status_id", order_by: "asc" }],
            filter: [{ field: "task_status_label", operator: "=", value: status }],
            page: 1,
            limit: 1
        }).then(result => {
            if (result.items.length === 0) {
                throw new Error("Task status not found")
            }
            return result.items[0].task_status_id
        });

        // Update the task status if valid
        await this.taskDataSource.updateOne({ task_id: task_to_update.task_id, task_status_id: transition_status_id });


        // Logging task status update in the log file
        await this.logMessage(task_to_update.task_log_file_path, `Task status updated from ${task_to_update.task_status} to ${status}`);
    }
}