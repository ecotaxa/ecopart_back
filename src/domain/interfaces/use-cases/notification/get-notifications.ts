import { UserUpdateModel } from "../../../entities/user";
import { NotificationResponseModel } from "../../../entities/notification";
import { SearchInfo } from "../../../entities/search";

export interface GetNotificationsUseCase {
    execute(current_user: UserUpdateModel, options: { unread_only: boolean, page: number, limit: number }): Promise<{ notifications: NotificationResponseModel[], search_info: SearchInfo, unread_count: number }>;
}
