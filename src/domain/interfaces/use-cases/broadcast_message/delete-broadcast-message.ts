import { UserUpdateModel } from "../../../entities/user";

export interface DeleteBroadcastMessageUseCase {
    execute(current_user: UserUpdateModel): Promise<void>;
}
