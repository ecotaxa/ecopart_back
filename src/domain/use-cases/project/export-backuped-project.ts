
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../interfaces/repositories/project-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { TaskRepository } from "../../interfaces/repositories/task-repository";

import { ExportBackupedProjectUseCase } from "../../interfaces/use-cases/project/export-backuped-project";
import { ProjectResponseModel } from "../../entities/project";
import { PublicTaskRequestCreationModel, TaskResponseModel, TasksStatus, TaskType } from "../../entities/task";

export class ExportBackupedProject implements ExportBackupedProjectUseCase {
    userRepository: UserRepository
    privilegeRepository: PrivilegeRepository
    projectRepository: ProjectRepository
    taskRepository: TaskRepository
    DATA_STORAGE_FS_STORAGE: string
    DATA_STORAGE_FTP_EXPORT: string
    base_url_path: string

    constructor(userRepository: UserRepository, privilegeRepository: PrivilegeRepository, projectRepository: ProjectRepository, taskRepository: TaskRepository, DATA_STORAGE_FS_STORAGE: string, DATA_STORAGE_FTP_EXPORT: string, base_url_path: string) {
        this.userRepository = userRepository
        this.privilegeRepository = privilegeRepository
        this.projectRepository = projectRepository
        this.taskRepository = taskRepository
        this.DATA_STORAGE_FS_STORAGE = DATA_STORAGE_FS_STORAGE
        this.DATA_STORAGE_FTP_EXPORT = DATA_STORAGE_FTP_EXPORT
        this.base_url_path = base_url_path
    }

    async execute(current_user: UserUpdateModel, project_id: number, out_to_ftp: boolean): Promise<TaskResponseModel> {

        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Ensure the current user has permission to get the backuped project
        await this.ensureUserCanGet(current_user, project_id);

        // Get the project
        const project: ProjectResponseModel = await this.getProjectIfExist(project_id);

        // Create a task export backuped project
        const task_id = await this.createExportBackupedProjectTask(current_user, project, out_to_ftp);

        // get the task
        const task = await this.taskRepository.getOneTask({ task_id: task_id });
        if (!task) {
            throw new Error("Cannot find task");
        }

        // start the task
        this.startExportBackupedProjectTask(task, project, out_to_ftp);

        return task;
    }

    async createExportBackupedProjectTask(current_user: UserUpdateModel, project: ProjectResponseModel, out_to_ftp: boolean): Promise<number> {
        const task: PublicTaskRequestCreationModel = {
            task_type: TaskType.Export_Backup,
            task_status: TasksStatus.Pending,
            task_owner_id: current_user.user_id,
            task_project_id: project.project_id,
            task_params: {
                out_to_ftp: out_to_ftp
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

    private async startExportBackupedProjectTask(task: TaskResponseModel, project: ProjectResponseModel, out_to_ftp: boolean) {
        const task_id = task.task_id;
        try {
            await this.taskRepository.startTask({ task_id: task_id });

            // 1/3 Do validation before importing 0->25%
            await this.ensureBackupExist(project.project_id, task_id);

            // 2/3 Export backuped project 25->99%
            const result = await this.exportBackupedProject(task, project, out_to_ftp);
            // finish task
            await this.taskRepository.finishTask({ task_id: task_id }, result);
        } catch (error) {
            await this.taskRepository.failedTask(task_id, error);
            return;
        }
    }

    async exportBackupedProject(task: TaskResponseModel, project: ProjectResponseModel, out_to_ftp: boolean): Promise<string> {
        await this.taskRepository.updateTaskProgress({ task_id: task.task_id }, 25, "Step 2/3 Export backuped project, export to fs : start");
        const dl_link = await this.exportToFs(project, task.task_id);
        // log dl link in task
        await this.taskRepository.logMessage(task.task_log_file_path, "Exported at : " + dl_link);
        // update task with download link ex :
        const download_link = this.base_url_path + "/api/tasks/" + task.task_id + "/export";
        if (out_to_ftp) {
            await this.taskRepository.updateTaskProgress({ task_id: task.task_id }, 60, "Step 2/3 Export backuped project, export to fs : done");
            await this.taskRepository.updateTaskProgress({ task_id: task.task_id }, 60, "Step 2/3 Export backuped project, export to ftp : start");
            const ftp_link = await this.exportToFtp(project, task.task_id);
            await this.taskRepository.updateTaskProgress({ task_id: task.task_id }, 99, "Step 2/3 Export backuped project, export to ftp : done");
            return ftp_link + " " + download_link;
        } else {
            await this.taskRepository.updateTaskProgress({ task_id: task.task_id }, 99, "Step 2/3 Export backuped project, export to fs : done");
            return download_link;
            // update task with donload link
        }
    }

    async exportToFs(project: ProjectResponseModel, task_id: number): Promise<string> {
        const fs_export_path = await this.projectRepository.exportBackupedProjectToFs(project, task_id);
        return fs_export_path;
    }
    async exportToFtp(project: ProjectResponseModel, task_id: number): Promise<string> {
        const ftp_export_path = await this.projectRepository.exportBackupedProjectToFtp(project, task_id);
        return ftp_export_path
    }

    async ensureBackupExist(project_id: number, task_id: number) {
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 15, "Step 1/3 Validation, ensure the project has been backuped: start");
        await this.projectRepository.ensureBackupExist(project_id);
        await this.taskRepository.updateTaskProgress({ task_id: task_id }, 25, "Step 1/3 Validation, ensure the project has been backuped: done");
    }
}