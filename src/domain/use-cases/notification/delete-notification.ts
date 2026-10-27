import { UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { NotificationRepository } from "../../interfaces/repositories/notification-repository";
import { DeleteNotificationUseCase } from "../../interfaces/use-cases/notification/delete-notification";

export class DeleteNotification implements DeleteNotificationUseCase {
    userRepository: UserRepository;
    notificationRepository: NotificationRepository;

    constructor(userRepository: UserRepository, notificationRepository: NotificationRepository) {
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
    }

    // Only the recipient deletes a notification; a notification of another user is reported as not found.
    async execute(current_user: UserUpdateModel, notification_id: number): Promise<void> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        const deleted = await this.notificationRepository.deleteNotification(current_user.user_id, notification_id);
        if (deleted === 0) throw new Error("Notification not found");
    }
}
