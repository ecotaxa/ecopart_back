import { Response } from "express";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { TaskRepository } from "../../interfaces/repositories/task-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { StreamZipFileUseCase } from "../../interfaces/use-cases/task/stream-zip-file";
import * as fs from 'fs'; // For createWriteStream

export class StreamZipFile implements StreamZipFileUseCase {
    taskRepository: TaskRepository
    userRepository: UserRepository
    privilegeRepository: PrivilegeRepository

    constructor(taskRepository: TaskRepository, userRepository: UserRepository, privilegeRepository: PrivilegeRepository) {
        this.taskRepository = taskRepository
        this.userRepository = userRepository
        this.privilegeRepository = privilegeRepository
    }

    async execute(current_user: UserUpdateModel, task_id: number, res: Response): Promise<void> {
        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);


        const task = await this.taskRepository.getOneTask({ task_id: task_id });
        // Ensure the task to get exists
        if (!task) { throw new Error("Cannot find task"); }

        // Ensure the current user has permission to get the task
        await this.ensureUserCanGet(current_user, task.task_owner_id, task.task_project_id);

        // Get the file path
        const zipFilePath = await this.taskRepository.getZipFilePath(task_id);

        if (!fs.existsSync(zipFilePath)) {
            throw new Error("ZIP file not found");
        }

        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${zipFilePath}"`
        );

        const fileStream = fs.createReadStream(zipFilePath);
        fileStream.pipe(res);
    }

    //TODO factoriser les fonctions de vérification de permission
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