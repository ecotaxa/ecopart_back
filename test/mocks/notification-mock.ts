import { NotificationResponseModel } from "../../src/domain/entities/notification";
import { SearchResult } from "../../src/domain/entities/search";
import { NotificationRepository } from "../../src/domain/interfaces/repositories/notification-repository";

export class MockNotificationRepository implements NotificationRepository {
    onTaskEnded(): Promise<void> {
        throw new Error("Method not implemented : onTaskEnded");
    }
    getNotification(): Promise<NotificationResponseModel | null> {
        throw new Error("Method not implemented : getNotification");
    }
    getNotifications(): Promise<SearchResult<NotificationResponseModel>> {
        throw new Error("Method not implemented : getNotifications");
    }
    countUnread(): Promise<number> {
        throw new Error("Method not implemented : countUnread");
    }
    markRead(): Promise<void> {
        throw new Error("Method not implemented : markRead");
    }
    markAllRead(): Promise<number> {
        throw new Error("Method not implemented : markAllRead");
    }
    deleteNotification(): Promise<number> {
        throw new Error("Method not implemented : deleteNotification");
    }
}
