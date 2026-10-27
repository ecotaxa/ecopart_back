import { UserUpdateModel } from "../../entities/user";
import { NotificationResponseModel } from "../../entities/notification";
import { SearchInfo } from "../../entities/search";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { NotificationRepository } from "../../interfaces/repositories/notification-repository";
import { GetNotificationsUseCase } from "../../interfaces/use-cases/notification/get-notifications";

export class GetNotifications implements GetNotificationsUseCase {
    userRepository: UserRepository;
    notificationRepository: NotificationRepository;

    constructor(userRepository: UserRepository, notificationRepository: NotificationRepository) {
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
    }

    // A user only ever sees their own notifications, newest first.
    async execute(current_user: UserUpdateModel, options: { unread_only: boolean, page: number, limit: number }): Promise<{ notifications: NotificationResponseModel[], search_info: SearchInfo, unread_count: number }> {
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);

        const result = await this.notificationRepository.getNotifications({ user_id: current_user.user_id, ...options });
        const unread_count = await this.notificationRepository.countUnread(current_user.user_id);
        const search_info: SearchInfo = {
            total: result.total,
            limit: options.limit,
            total_on_page: result.items.length,
            page: options.page,
            pages: Math.ceil(result.total / options.limit) || 1,
        };
        return { notifications: result.items, search_info, unread_count };
    }
}
