import { UserUpdateModel } from "../../../entities/user";

export interface DeleteNotificationUseCase {
    execute(current_user: UserUpdateModel, notification_id: number): Promise<void>;
}
