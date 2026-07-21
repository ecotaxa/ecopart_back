import { UserUpdateModel } from "../../../entities/user";
import { BroadcastMessageRequestCreationModel, BroadcastMessageResponseModel } from "../../../entities/broadcast_message";

export interface SetBroadcastMessageUseCase {
    execute(current_user: UserUpdateModel, message: BroadcastMessageRequestCreationModel): Promise<BroadcastMessageResponseModel>;
}
