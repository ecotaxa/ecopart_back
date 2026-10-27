import { UserUpdateModel } from "../../../entities/user";

export interface MarkNotificationReadUseCase {
    execute(current_user: UserUpdateModel, notification_id: number): Promise<void>;
}
