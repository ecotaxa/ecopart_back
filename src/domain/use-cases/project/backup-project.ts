
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { TaskLogger, TaskRepository } from "../../interfaces/repositories/task-repository";

import { BackupProjectUseCase } from "../../interfaces/use-cases/project/backup-project";
import { ProjectResponseModel } from "../../entities/project";
import { PublicTaskRequestCreationModel, PublicTaskResponseModel, TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";
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

    async execute(current_user: UserUpdateModel, project_id: number, skip_already_imported: boolean): Promise<PublicTaskResponseModel> {

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
        // Fire-and-forget: failures are recorded on the task inside; only a failure to record one (task deleted
        // meanwhile, database unavailable) reaches this catch, which keeps it from stopping the server.
        this.startBackupProjectTask(task, project, skip_already_imported)
            .catch((error) => console.log(new Date().toISOString(), `Backup task ${task.task_id} could not record its outcome`, error));

        return this.taskRepository.toPublicTask(task);
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

        // Import and export of the L0-b backup both work on the project's l0b_backup folder: only one
        // backup task, of either type, may be active on a project at a time. Refused before any task
        // exists, so the caller gets the conflict as an HTTP error.
        const task_id = await this.taskRepository.createTaskUnlessActive(task, [TaskType.Import_Backup, TaskType.Export_Backup]);
        if (task_id === null) throw new Error("A backup task is already running for this project");
        return task_id;
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

    private async startBackupProjectTask(task: TaskResponseModel, project: ProjectResponseModel, skip_already_imported: boolean) {
        const task_id = task.task_id;
        try {
            await this.taskRepository.startTask({ task_id: task_id });

            // 1/2 Do validation before importing 0->25%
            await this.ensureFolderStructureForBackup(project.root_folder_path, task_id);

            // Last point where a cancellation leaves nothing behind
            await this.taskRepository.throwIfCancelled(task_id);

            // 2/2 Copy source files to hiden project folder 25->100%
            await this.copySourcesToBackupProjectFolder(task, project, skip_already_imported);

            // Record the backup date on the project
            await this.projectRepository.standardUpdateProject({ project_id: project.project_id, last_backup_utc_date_time: new Date().toISOString() });

            // finish task
            await this.taskRepository.finishTask({ task_id: task_id });
        } catch (error) {
            await this.taskRepository.failedTask(task_id, error);
            return;
        }
    }
    async ensureFolderStructureForBackup(root_folder_path: string, task_id: number) {
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 0, "Step 1/2 Validation, ensure folder structure is correct: start");
        await this.projectRepository.ensureFolderStructureForBackup(root_folder_path);
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 25, "Step 1/2 Validation, ensure folder structure is correct: done");
    }

    async copySourcesToBackupProjectFolder(task: TaskResponseModel, project: ProjectResponseModel, skip_already_imported: boolean) {
        const task_id = task.task_id;
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 25, "Step 2/2 L0-b backup folders copy : start");

        const dest_folder = path.join(this.DATA_STORAGE_FS_STORAGE, `${project.project_id}`, "l0b_backup");
        const root_folder_path = project.root_folder_path;
        const log: TaskLogger = (message) => this.taskRepository.logMessage(task.task_log_file_path, "Step 2/2 L0-b backup folders copy : " + message);
        await log(`from ${root_folder_path} to ${dest_folder}, ${skip_already_imported ? "raw folders already in the backup are skipped" : "every raw folder is written again"}`);

        // Copy sources files to project folder
        await this.projectRepository.copyL0bToProjectFolder(root_folder_path, dest_folder, skip_already_imported, log);
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 99, "Step 2/2 L0-b backup folders copy : done");
    }

    async getLastBackupDate(current_user: UserUpdateModel, project_id: number): Promise<string | null> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        await this.ensureUserCanGet(current_user, project_id);
        const project = await this.getProjectIfExist(project_id);
        return project.last_backup_utc_date_time ?? null;
    }

}