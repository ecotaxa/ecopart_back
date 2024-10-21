import { PublicTaskRequestModel } from "../../entities/task";
import { UserUpdateModel } from "../../entities/user";
import { PrivilegeRepository } from "../../interfaces/repositories/privilege-repository";
import { TaskRepository } from "../../interfaces/repositories/task-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { DeleteTaskUseCase } from "../../interfaces/use-cases/task/delete-task";

export class DeleteTask implements DeleteTaskUseCase {
    userRepository: UserRepository
    taskRepository: TaskRepository
    privilegeRepository: PrivilegeRepository

    constructor(userRepository: UserRepository, taskRepository: TaskRepository, privilegeRepository: PrivilegeRepository) {
        this.userRepository = userRepository
        this.taskRepository = taskRepository
        this.privilegeRepository = privilegeRepository
    }

    async execute(current_user: UserUpdateModel, task_to_delete: PublicTaskRequestModel): Promise<void> {
        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        // Ensure the task to delete exists
        await this.ensureTaskExists(task_to_delete);

        // Ensure the current user has permission to delete the task
        await this.ensureUserCanDelete(current_user);

        // Delete the task
        await this.deleteTask(task_to_delete);
    }

    // Ensure the task to delete exists
    private async ensureTaskExists(task: PublicTaskRequestModel): Promise<void> {
        await this.taskRepository.getTask(task).then(task => {
            if (!task) {
                throw new Error("Cannot find task to delete");
            }
        })
    }

    // Ensure user is admin to delete the task
    private async ensureUserCanDelete(current_user: UserUpdateModel): Promise<void> {
        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);

        if (userIsAdmin) {
            return
        }

        throw new Error("Logged user cannot delete this task");
    }

    // Delete the task
    private async deleteTask(task: PublicTaskRequestModel): Promise<void> {
        const deletedTasksCount = await this.taskRepository.deleteTask(task);
        if (deletedTasksCount === 0) {
            throw new Error("Cannot delete task");
        }
    }
}