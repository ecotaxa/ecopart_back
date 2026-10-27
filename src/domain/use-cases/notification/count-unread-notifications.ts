import { UserUpdateModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { NotificationRepository } from "../../interfaces/repositories/notification-repository";
import { CountUnreadNotificationsUseCase } from "../../interfaces/use-cases/notification/count-unread-notifications";

export class CountUnreadNotifications implements CountUnreadNotificationsUseCase {
    userRepository: UserRepository;
    notificationRepository: NotificationRepository;

    constructor(userRepository: UserRepository, notificationRepository: NotificationRepository) {
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
    }

    async execute(current_user: UserUpdateModel): Promise<number> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        return await this.notificationRepository.countUnread(current_user.user_id);
    }
}
