import { UserUpdateModel } from "../../../entities/user";

export interface MarkAllNotificationsReadUseCase {
    execute(current_user: UserUpdateModel): Promise<number>;
}
