import { UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { NotificationRepository } from "../../interfaces/repositories/notification-repository";
import { MarkAllNotificationsReadUseCase } from "../../interfaces/use-cases/notification/mark-all-notifications-read";

export class MarkAllNotificationsRead implements MarkAllNotificationsReadUseCase {
    userRepository: UserRepository;
    notificationRepository: NotificationRepository;

    constructor(userRepository: UserRepository, notificationRepository: NotificationRepository) {
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
    }

    // Returns how many notifications were unread.
    async execute(current_user: UserUpdateModel): Promise<number> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        return await this.notificationRepository.markAllRead(current_user.user_id);
    }
}
