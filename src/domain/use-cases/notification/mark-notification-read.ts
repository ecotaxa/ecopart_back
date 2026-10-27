import { UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { NotificationRepository } from "../../interfaces/repositories/notification-repository";
import { MarkNotificationReadUseCase } from "../../interfaces/use-cases/notification/mark-notification-read";

export class MarkNotificationRead implements MarkNotificationReadUseCase {
    userRepository: UserRepository;
    notificationRepository: NotificationRepository;

    constructor(userRepository: UserRepository, notificationRepository: NotificationRepository) {
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
    }

    // Marking an already read notification is a no-op. A notification of another user is reported
    // as not found, so its existence is not disclosed.
    async execute(current_user: UserUpdateModel, notification_id: number): Promise<void> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        const notification = await this.notificationRepository.getNotification(notification_id);
        if (!notification || notification.user_id !== current_user.user_id) throw new Error("Notification not found");

        await this.notificationRepository.markRead(current_user.user_id, notification_id);
    }
}
