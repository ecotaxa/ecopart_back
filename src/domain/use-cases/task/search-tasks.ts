import { FilterSearchOptions, PreparedSearchOptions, SearchInfo, SearchOptions, SearchResult } from "../../entities/search";
import { UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { SearchRepository } from "../../interfaces/repositories/search-repository";
import { TaskRepository } from "../../interfaces/repositories/task-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { SearchTasksUseCase } from "../../interfaces/use-cases/task/search-task";
import { TaskResponseModel } from "../../entities/task";

export class SearchTask implements SearchTasksUseCase {
    userRepository: UserRepository
    taskRepository: TaskRepository
    searchRepository: SearchRepository
    projectRepository: ProjectRepository
    privilegeRepository: PrivilegeRepository

    constructor(userRepository: UserRepository, taskRepository: TaskRepository, searchRepository: SearchRepository, projectRepository: ProjectRepository, privilegeRepository: PrivilegeRepository) {
        this.userRepository = userRepository
        this.taskRepository = taskRepository
        this.searchRepository = searchRepository
        this.projectRepository = projectRepository
        this.privilegeRepository = privilegeRepository
    }
    async execute(current_user: UserUpdateModel, options: SearchOptions, filters: FilterSearchOptions[]): Promise<{ tasks: TaskResponseModel[], search_info: SearchInfo }> {
        // DONE define wanted cases sensitivity : = is perfect match and LIKE is case insensitive

        // Ensure the current user is valid and not deleted
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Prepare search options
        let prepared_options: PreparedSearchOptions = this.prepareSearchOptions(options, filters);

        // Apply additional filters
        prepared_options = await this.applyAdditionalFilters(current_user, prepared_options);

        // Fetch tasks based on prepared search options
        const result: SearchResult<TaskResponseModel> = await this.taskRepository.standardGetTasks(prepared_options);

        // Format search info
        const search_info: SearchInfo = this.searchRepository.formatSearchInfo(result, prepared_options);

        // Get the tasks from the result
        const tasks = result.items;

        // Return the search info and tasks
        return { search_info, tasks };
    }


    // Prepares the search options by formatting filters and sort options.
    private prepareSearchOptions(options: SearchOptions, filters: FilterSearchOptions[]): PreparedSearchOptions {
        options.filter = filters && filters.length > 0 ? this.searchRepository.formatFilters(filters) : [];
        if (options.sort_by) options.sort_by = this.searchRepository.formatSortBy(options.sort_by as string);
        return options as PreparedSearchOptions;
    }

    // Applies additional filters based on specific conditions.
    private async applyAdditionalFilters(current_user: UserUpdateModel, options: PreparedSearchOptions): Promise<PreparedSearchOptions> {
        if (options.filter.length > 0) {
            options = await this.applyTaskStatusFilter(options);
            options = await this.applyTaskTypeFilter(options);
            options = await this.applyManagingFilter(current_user, options);
        }
        options = await this.applyUserCanGetFilter(current_user, options);

        return options;
    }

    // Applies the task_status model filter.
    private async applyTaskStatusFilter(options: PreparedSearchOptions): Promise<PreparedSearchOptions> {
        // If filter on instrument model, searsch id of instrument model matching the filter and then set the filter to IN [] of instrument model id
        const taskFilter = options.filter.find(f => f.field === "task_status");
        if (taskFilter) {
            const tasks = await this.taskRepository.standardGetTaskStatus({
                filter: [{ field: "task_status_label", operator: taskFilter.operator, value: taskFilter.value }],
                sort_by: [],
                limit: 1000,
                page: 1
            });

            if (tasks.total === 0) {
                throw new Error("Task status label not found");
            }

            // Set the new filter for task_status label operator to IN and value to array of task_status id
            taskFilter.field = "task_status_id";
            taskFilter.operator = "IN";
            taskFilter.value = tasks.items.map(i => i.task_status_id);

            // Remove the old filter
            options.filter = options.filter.filter(f => f.field !== "task_status");
            // Add the new filter
            options.filter.push(taskFilter);
        }
        return options;
    }
    // Applies the instrument model filter.
    private async applyTaskTypeFilter(options: PreparedSearchOptions): Promise<PreparedSearchOptions> {
        // If filter on instrument model, searsch id of instrument model matching the filter and then set the filter to IN [] of instrument model id
        const taskFilter = options.filter.find(f => f.field === "task_type");
        if (taskFilter) {
            const tasks = await this.taskRepository.standardGetTaskType({
                filter: [{ field: "task_type_id", operator: taskFilter.operator, value: taskFilter.value }],
                sort_by: [],
                limit: 1000,
                page: 1
            });

            if (tasks.total === 0) {
                throw new Error("Task type label not found");
            }

            // Set the new filter for instrument model operator to IN and value to array of instrument model id
            taskFilter.field = "task_type_id";
            taskFilter.operator = "IN";
            taskFilter.value = tasks.items.map(i => i.task_type_id);

            // Remove the old filter
            options.filter = options.filter.filter(f => f.field !== "task_type");
            // Add the new filter
            options.filter.push(taskFilter);
        }
        return options;
    }

    // Applies the managing filter.
    private async applyManagingFilter(current_user: UserUpdateModel, options: PreparedSearchOptions): Promise<PreparedSearchOptions> {
        const managingFilter = options.filter.find(f => f.field === "for_managing");
        // If filter is for managing = true, get all tasks where current_user is owner
        if (managingFilter) {
            // Delete the filter
            options.filter = options.filter.filter(f => f.field !== "for_managing");

            // If filter is for managing = true, get all tasks where current_user is owner
            if (managingFilter.value === "true" || managingFilter.value === true) {
                const taskIds = await this.taskRepository.getTasksByUser({ user_id: current_user.user_id });
                // Add the new filter to the list of filters
                options.filter.push({ field: "task_id", operator: "IN", value: taskIds });
            } else if (!(managingFilter.value === "false" || managingFilter.value === false)) {
                throw new Error("Task managing filter value is not valid");
            }
        }
        return options;
    }

    // Applies the user_can_get filter.
    private async applyUserCanGetFilter(current_user: UserUpdateModel, options: PreparedSearchOptions): Promise<PreparedSearchOptions> {
        // Admins can get all tasks
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        if (userIsAdmin) return options

        // If the user is owner of the task, allow access
        options.filter.push({ field: "task_owner_id", operator: "=", value: current_user.user_id });

        // If the user have privileges in the project, allow access
        const projectIds = await this.privilegeRepository.getProjectsByUser({ user_id: current_user.user_id });
        options.filter.push({ field: "task_project_id", operator: "IN", value: [...projectIds, null] }); // TODO TEST the combinaison of filters when data allows it

        return options;
    }

}
