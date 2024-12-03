
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { TaskRepository } from "../../interfaces/repositories/task-repository";

import { BackupProjectUseCase } from "../../interfaces/use-cases/project/backup-project";
import { ProjectResponseModel } from "../../entities/project";
import { PrivateTaskRequestModel, PublicTaskRequestCreationModel, TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";
import { PreparedSearchOptions } from "../../entities/search";
import path from "path";

export class BackupProject implements BackupProjectUseCase {
    userRepository: UserRepository
    privilegeRepository: PrivilegeRepository
    projectRepository: ProjectRepository
    taskRepository: TaskRepository
    DATA_STORAGE_FS_STORAGE: string

    constructor(userRepository: UserRepository, privilegeRepository: PrivilegeRepository, projectRepository: ProjectRepository, taskRepository: TaskRepository, DATA_STORAGE_FS_STORAGE: string) {
        this.userRepository = userRepository
        this.privilegeRepository = privilegeRepository
        this.projectRepository = projectRepository
        this.taskRepository = taskRepository
        this.DATA_STORAGE_FS_STORAGE = DATA_STORAGE_FS_STORAGE
    }

    async execute(current_user: UserUpdateModel, project_id: number, skip_already_imported: boolean): Promise<TaskResponseModel> {

        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Ensure the current user has permission to backup project
        await this.ensureUserCanGet(current_user, project_id);

        // Get the project
        const project: ProjectResponseModel = await this.getProjectIfExist(project_id);

        // Create a task to backup project
        const task_id = await this.createBackupProjectTask(current_user, project, skip_already_imported);

        // get the task
        const task = await this.taskRepository.getOneTask({ task_id: task_id });
        if (!task) {
            throw new Error("Cannot find task");
        }

        // start the task
        this.startBackupProjectTask(task, project.instrument_model, project, current_user, skip_already_imported);

        return task;
    }

    async createBackupProjectTask(current_user: UserUpdateModel, project: ProjectResponseModel, skip_already_imported: boolean): Promise<number> {
        const task: PublicTaskRequestCreationModel = {
            task_type: TaskType.Import_Backup,
            task_status: TasksStatus.Pending,
            task_owner_id: current_user.user_id,
            task_project_id: project.project_id,
            task_params: {
                root_folder_path: project.root_folder_path,
                skip_already_imported: skip_already_imported
            }
        }

        return await this.taskRepository.createTask(task);
    }


    private async getProjectIfExist(project_id: number): Promise<ProjectResponseModel> {
        const project = await this.projectRepository.getProject({ project_id: project_id });
        if (!project) {
            throw new Error("Cannot find project");
        }
        return project;
    }

    private async ensureUserCanGet(current_user: UserUpdateModel, project_id: number): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        const userHasPrivilege = await this.privilegeRepository.isGranted({
            user_id: current_user.user_id,
            project_id: project_id
        });
        if (!userIsAdmin && !userHasPrivilege) {
            throw new Error("Logged user cannot list importable samples in this project");
        }
    }

    private async startBackupProjectTask(task: TaskResponseModel, instrument_model: string, project: ProjectResponseModel, current_user: UserUpdateModel, skip_already_imported: boolean) {
        const task_id = task.task_id;
        try {
            await this.taskRepository.startTask({ task_id: task_id });

            // 1/3 Do validation before importing 0->15%
            await this.ensureNoExportBackupIsRunning(project, task_id);
            // 2/3 Do validation before importing 15->25%
            await this.ensureFolderStructureForBackup(project.root_folder_path, task_id);

            // 3/3 Copy source files to hiden project folder 25->100%
            await this.copySourcesToBackupProjectFolder(task_id, project, skip_already_imported);

            // finish task
            await this.taskRepository.finishTask({ task_id: task_id });
        } catch (error) {
            await this.taskRepository.failedTask(task_id, error);
            return;
        }
    }
    async ensureFolderStructureForBackup(root_folder_path: string, task_id: number) {
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 15, "Step 2/3 Validation, ensure folder structure is correct: start");
        await this.projectRepository.ensureFolderStructureForBackup(root_folder_path);
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 25, "Step 2/3 Validation, ensure folder structure is correct: done");
    }

    async ensureNoExportBackupIsRunning(project: ProjectResponseModel, task_id: number) {
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 0, "Step 1/3 Validation, no backup is running: start");

        const options_type: PreparedSearchOptions = {
            filter: [
                { field: 'task_type_label', operator: '=', value: TaskType.Export_Backup }
            ],
            sort_by: [],
            page: 1,
            limit: 1
        }
        const option_status: PreparedSearchOptions = {
            filter: [
                { field: 'task_status_label', operator: '=', value: TasksStatus.Running }
            ],
            sort_by: [],
            page: 1,
            limit: 1
        }
        const task_type_id = (await this.taskRepository.standardGetTaskType(options_type)).items[0].task_type_id;
        const task_status_id = (await this.taskRepository.standardGetTaskStatus(option_status)).items[0].task_status_id;

        const options_project: PrivateTaskRequestModel = {
            task_type_id,
            task_status_id,
            task_project_id: project.project_id
        }
        const task = await this.taskRepository.getOneTask(options_project);
        if (task) {
            throw new Error("An export backup is already running for this project");
        }
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 15, "Step 1/3 Validation, no backup is running: done");
    }

    async copySourcesToBackupProjectFolder(task_id: number, project: ProjectResponseModel, skip_already_imported: boolean) {
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 25, "Step 3/3 L0-b backup folders copy : start");

        const dest_folder = path.join(this.DATA_STORAGE_FS_STORAGE, `${project.project_id}`, "l0b_backup");
        const root_folder_path = project.root_folder_path;

        // Copy sources files to project folder
        await this.projectRepository.copyL0bToProjectFolder(root_folder_path, dest_folder, skip_already_imported);
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 99, "Step 3/3 L0-b backup folders copy : done");
    }

}