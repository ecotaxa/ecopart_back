
import { TaskDataSource } from "../../data/interfaces/data-sources/task-data-source";
import { PreparedSearchOptions, SearchResult } from "../entities/search";
// import { InstrumentModelResponseModel } from "../entities/instrument_model";
// import { PublicPrivilege } from "../entities/privilege";
// import { TaskRequestCreationModel, PrivateTaskRequestModel, TaskUpdateModel, TaskResponseModel, PublicTaskResponseModel, PublicTaskRequestCreationModel } from "../entities/task";
import { PrivateTaskRequestModel, TaskResponseModel, TaskStatusResponseModel, TaskTypeResponseModel } from "../entities/task";
import { UserRequestModel } from "../entities/user";
// import { PreparedSearchOptions, SearchResult } from "../entities/search";
import { TaskRepository } from "../interfaces/repositories/task-repository";
import fs from 'node:fs/promises';

export class TaskRepositoryImpl implements TaskRepository {
    taskDataSource: TaskDataSource

    // TODO move to a search repository
    order_by_allow_params: string[] = ["asc", "desc"]
    filter_operator_allow_params: string[] = ["=", ">", "<", ">=", "<=", "<>", "IN", "LIKE"]

    constructor(taskDataSource: TaskDataSource) {
        this.taskDataSource = taskDataSource
    }

    // async createTask(task: TaskRequestCreationModel): Promise<number> {
    //     const result = await this.taskDataSource.create(task)
    //     return result;
    // }

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
            const data = await fs.readFile(task_log_file_path, { encoding: 'utf8' });
            return data;
        } catch (err) {
            // if error, throw an error
            console.log(err);
            throw new Error("Cannot read log file");
        }
    }
}