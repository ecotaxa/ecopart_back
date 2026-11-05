import { PublicTaskResponseModel, TaskProjectModel, TaskResponseModel, TaskType } from "../../entities/task";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { SampleRepository } from "../../interfaces/repositories/sample-repository";
import { TaskRepository } from "../../interfaces/repositories/task-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { GetOneTaskUseCase } from "../../interfaces/use-cases/task/get-one-task";

const EXPORT_TASK_TYPES: string[] = [TaskType.Export, TaskType.Export_Backup, TaskType.Export_Raw];

export class GetOneTask implements GetOneTaskUseCase {
    taskRepository: TaskRepository
    userRepository: UserRepository
    privilegeRepository: PrivilegeRepository
    sampleRepository: SampleRepository
    projectRepository: ProjectRepository

    constructor(taskRepository: TaskRepository, userRepository: UserRepository, privilegeRepository: PrivilegeRepository, sampleRepository: SampleRepository, projectRepository: ProjectRepository) {
        this.taskRepository = taskRepository
        this.userRepository = userRepository
        this.privilegeRepository = privilegeRepository
        this.sampleRepository = sampleRepository
        this.projectRepository = projectRepository
    }

    async execute(current_user: UserUpdateModel, task_id: number): Promise<PublicTaskResponseModel> {
        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);


        const task = await this.taskRepository.getOneTask({ task_id: task_id });
        // Ensure the task to get exists
        if (!task) { throw new Error("Cannot find task"); }

        // Ensure the current user has permission to get the task
        await this.ensureUserCanGet(current_user, task.task_owner_id, task.task_project_id);

        const public_task = this.taskRepository.toPublicTask(task);
        if (EXPORT_TASK_TYPES.includes(task.task_type)) {
            public_task.task_projects = await this.getExportedProjects(task);
        }
        return public_task;
    }

    // A backup export is attached to its project. A raw or binned export can span several projects
    // and stores their ids. A deleted project is left out. The projects are read in one query: the
    // task page reads a running task every few seconds, and a bulk export spans hundreds of projects.
    private async getExportedProjects(task: TaskResponseModel): Promise<TaskProjectModel[]> {
        const project_ids = task.task_project_id ? [task.task_project_id] : await this.getExportedProjectIds(task);
        if (project_ids.length === 0) return [];
        const projects = await this.projectRepository.standardGetProjects({
            filter: [{ field: "project_id", operator: "IN", value: project_ids }],
            sort_by: [{ sort_by: "project_id", order_by: "asc" }],
            page: 1,
            limit: project_ids.length,
        });
        return projects.items.map(project => ({ project_id: project.project_id, project_title: project.project_title }));
    }

    // An export created before project_ids was stored only has its samples: its projects are found
    // through them, which reads every sample row. Such a task is finished (an interrupted one is
    // closed at startup), so the task page reads it once instead of polling it.
    private async getExportedProjectIds(task: TaskResponseModel): Promise<number[]> {
        const params = this.taskParams(task);
        if (Array.isArray(params.project_ids)) return params.project_ids as number[];
        const sample_ids = params.sample_ids;
        if (!Array.isArray(sample_ids) || sample_ids.length === 0) return [];
        const samples = await this.sampleRepository.getSamplesByIds(sample_ids);
        return Array.from(new Set(samples.map(sample => sample.project_id))).sort((a, b) => a - b);
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

    private async ensureUserCanGet(current_user: UserUpdateModel, owner_id: number, project_id?: number): Promise<void> {
        // Check if the user is the owner of the task
        const userIsOwner = current_user.user_id === owner_id;

        // If the user is the owner, allow access immediately
        if (userIsOwner) {
            return;
        }

        // Check if the current user is an admin
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);

        // If the user is an admin, allow access immediately
        if (userIsAdmin) {
            return;
        }

        // If a project_id is provided, check if the user has privileges in that project
        if (project_id) {
            const userHasPrivilege = await this.privilegeRepository.isGranted({
                user_id: current_user.user_id,
                project_id: project_id
            });

            // If the user has the necessary privileges, allow access
            if (userHasPrivilege) {
                return;
            }
        }

        // If none of the above conditions are met, throw an error
        throw new Error("User does not have the necessary permissions to access this task.");
    }

}