import { BroadcastMessageRequestCreationModel, BroadcastMessageResponseModel } from "../../entities/broadcast_message";

export interface BroadcastMessageRepository {
    getCurrentMessage(): Promise<BroadcastMessageResponseModel | null>;
    setMessage(created_by_user_id: number, message: BroadcastMessageRequestCreationModel): Promise<BroadcastMessageResponseModel>;
    deleteMessage(): Promise<void>;
}
