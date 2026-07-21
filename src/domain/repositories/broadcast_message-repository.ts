import { BroadcastMessageDataSource } from "../../data/interfaces/data-sources/broadcast_message-data-source";
import { BroadcastMessageRepository } from "../interfaces/repositories/broadcast_message-repository";
import { BroadcastMessageRequestCreationModel, BroadcastMessageResponseModel } from "../entities/broadcast_message";

export class BroadcastMessageRepositoryImpl implements BroadcastMessageRepository {
    broadcastMessageDataSource: BroadcastMessageDataSource;

    constructor(broadcastMessageDataSource: BroadcastMessageDataSource) {
        this.broadcastMessageDataSource = broadcastMessageDataSource;
    }

    getCurrentMessage(): Promise<BroadcastMessageResponseModel | null> {
        return this.broadcastMessageDataSource.getMessage();
    }

    setMessage(created_by_user_id: number, message: BroadcastMessageRequestCreationModel): Promise<BroadcastMessageResponseModel> {
        return this.broadcastMessageDataSource.setMessage({
            message: message.message,
            sub_message: message.sub_message ?? null,
            level: message.level,
            created_by_user_id,
            message_creation_utc_date_time: new Date().toISOString(),
        });
    }

    deleteMessage(): Promise<void> {
        return this.broadcastMessageDataSource.deleteMessage();
    }
}
