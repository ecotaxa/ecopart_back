// Notification — a message addressed to one user, shown in the front-end bell (e.g. "your import
// is finished"). Notifications are created by the server only; a user reads, marks and deletes theirs.

export enum NotificationType {
    TaskDone = "TASK_DONE",
    TaskError = "TASK_ERROR",
    TaskCancelled = "TASK_CANCELLED",
}

export interface NotificationRequestCreationModel {
    user_id: number;
    notification_type: NotificationType;
    notification_message: string;
    task_id?: number | null;
    project_id?: number | null;
}

export interface NotificationResponseModel {
    notification_id: number;
    user_id: number;
    notification_type: NotificationType;
    notification_message: string;
    task_id: number | null;
    project_id: number | null;
    is_read: boolean;
    notification_creation_utc_date_time: string;
}

// A page of the notifications of one user, newest first.
export interface NotificationSearchModel {
    user_id: number;
    unread_only: boolean;
    page: number;
    limit: number;
}
