import { UserUpdateModel } from "../../../entities/user";
export interface DeleteUserUseCase {
    execute(current_user: UserUpdateModel, user_to_update: UserUpdateModel): Promise<void>;
}