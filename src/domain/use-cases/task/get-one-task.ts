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
    // and only stores its samples, so its projects are found through them. A deleted project or
    // sample is left out.
    private async getExportedProjects(task: TaskResponseModel): Promise<TaskProjectModel[]> {
        const project_ids = task.task_project_id ? [task.task_project_id] : await this.getProjectIdsOfSamples(task);
        const projects = await Promise.all(project_ids.map(project_id => this.projectRepository.getProject({ project_id })));
        return projects.flatMap(project => project ? [{ project_id: project.project_id, project_title: project.project_title }] : []);
    }

    private async getProjectIdsOfSamples(task: TaskResponseModel): Promise<number[]> {
        const sample_ids = this.taskParams(task).sample_ids;
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