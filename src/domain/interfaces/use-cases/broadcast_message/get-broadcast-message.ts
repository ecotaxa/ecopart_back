import { UserUpdateModel } from "../../../entities/user";
import { BroadcastMessageResponseModel } from "../../../entities/broadcast_message";

export interface GetBroadcastMessageUseCase {
    execute(current_user: UserUpdateModel): Promise<BroadcastMessageResponseModel | null>;
}
