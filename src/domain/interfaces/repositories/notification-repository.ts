import { NotificationResponseModel, NotificationSearchModel } from "../../entities/notification";
import { SearchResult } from "../../entities/search";
import { TaskEndListener } from "./task-repository";

export interface NotificationRepository extends TaskEndListener {
    getNotification(notification_id: number): Promise<NotificationResponseModel | null>;
    getNotifications(search: NotificationSearchModel): Promise<SearchResult<NotificationResponseModel>>;
    countUnread(user_id: number): Promise<number>;
    markRead(user_id: number, notification_id: number): Promise<void>;
    markAllRead(user_id: number): Promise<number>;
    deleteNotification(user_id: number, notification_id: number): Promise<number>;
}
