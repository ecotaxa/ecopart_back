// Broadcast message — a single, application-wide banner an administrator can push to every
// user's front-end (e.g. maintenance notice, incident warning). The application holds at most
// ONE message at a time: setting a new one replaces the previous, and it can be cleared.

export enum MessageLevel {
    Info = "info",
    Warning = "warning",
    Error = "error",
}

// API input when an admin sets/replaces the current broadcast message.
export interface BroadcastMessageRequestCreationModel {
    message: string;
    sub_message?: string | null;
    level: MessageLevel;
}

// Fields persisted for the single message (everything but the pinned primary key).
export interface BroadcastMessagePersistenceModel {
    message: string;
    sub_message: string | null;
    level: MessageLevel;
    created_by_user_id: number | null;
    message_creation_utc_date_time: string;
}

// Full persisted row. Because the app keeps a single message, `broadcast_message_id` is pinned
// to 1 and there is never more than one row.
export interface BroadcastMessageResponseModel extends BroadcastMessagePersistenceModel {
    broadcast_message_id: number;
}
