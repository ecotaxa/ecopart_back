import { BroadcastMessagePersistenceModel, BroadcastMessageResponseModel } from "../../../domain/entities/broadcast_message";

export interface BroadcastMessageDataSource {
    // Returns the single current message, or null when none is set.
    getMessage(): Promise<BroadcastMessageResponseModel | null>;
    // Sets/replaces the single message and returns the stored row.
    setMessage(message: BroadcastMessagePersistenceModel): Promise<BroadcastMessageResponseModel>;
    // Clears the current message (no-op if none is set).
    deleteMessage(): Promise<void>;
}
