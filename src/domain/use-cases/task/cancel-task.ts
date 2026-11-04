import { PublicTaskResponseModel } from "../../entities/task";
import { UserUpdateModel } from "../../entities/user";
import { TaskRepository } from "../../interfaces/repositories/task-repository";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { CancelTaskUseCase } from "../../interfaces/use-cases/task/cancel-task";

export class CancelTask implements CancelTaskUseCase {
    taskRepository: TaskRepository
    userRepository: UserRepository

    constructor(taskRepository: TaskRepository, userRepository: UserRepository) {
        this.taskRepository = taskRepository
        this.userRepository = userRepository
    }

    async execute(current_user: UserUpdateModel, task_id: number): Promise<PublicTaskResponseModel> {
        // Ensure the user is valid and can be used
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        const task = await this.taskRepository.getOneTask({ task_id: task_id });
        // Ensure the task to cancel exists
        if (!task) { throw new Error("Cannot find task"); }

        // Ensure the current user has permission to cancel the task
        const cancelled_by = await this.ensureUserCanCancel(current_user, task.task_owner_id);

        // A pending task ends CANCELLED at once, a running one goes CANCELLING until its next checkpoint
        await this.taskRepository.cancelTask(task.task_id, cancelled_by);

        const cancelled_task = await this.taskRepository.getOneTask({ task_id: task.task_id });
        if (!cancelled_task) { throw new Error("Cannot find task"); }
        return this.taskRepository.toPublicTask(cancelled_task);
    }

    // Only the owner of the task or an admin can cancel it. Returns who they are, for the task message.
    private async ensureUserCanCancel(current_user: UserUpdateModel, owner_id: number): Promise<string> {
        if (current_user.user_id === owner_id) return `its owner ${await this.describeUser(current_user.user_id)}`;

        const userIsAdmin = await this.userRepository.isAdmin(current_user.user_id);
        if (userIsAdmin) return `administrator ${await this.describeUser(current_user.user_id)}`;

        throw new Error("Logged user cannot cancel this task");
    }

    // "Jane Doe (jane@doe.com)", as a task owner is shown
    private async describeUser(user_id: number): Promise<string> {
        const user = await this.userRepository.getUser({ user_id });
        return user ? `${user.first_name} ${user.last_name} (${user.email})` : `user ${user_id}`;
    }
}
