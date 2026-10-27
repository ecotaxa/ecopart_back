import { NotificationRequestCreationModel, NotificationResponseModel, NotificationSearchModel } from "../../../domain/entities/notification";
import { SearchResult } from "../../../domain/entities/search";

export interface NotificationDataSource {
    create(notification: NotificationRequestCreationModel & { notification_creation_utc_date_time: string }): Promise<number>;
    getOne(notification_id: number): Promise<NotificationResponseModel | null>;
    getAll(search: NotificationSearchModel): Promise<SearchResult<NotificationResponseModel>>;
    countUnread(user_id: number): Promise<number>;
    // Marks one notification (or, without id, all of them) of the user as read. Returns the rows changed.
    markRead(user_id: number, notification_id?: number): Promise<number>;
    deleteOne(user_id: number, notification_id: number): Promise<number>;
}
