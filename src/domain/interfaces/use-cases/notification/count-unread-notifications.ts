import { UserUpdateModel } from "../../../entities/user";

export interface CountUnreadNotificationsUseCase {
    execute(current_user: UserUpdateModel): Promise<number>;
}
