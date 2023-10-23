import { UserUpdateModel, UserResponseModel } from "../../../entities/user";
export interface UpdateUserUseCase {
    execute(current_user: UserUpdateModel, user_to_update: UserUpdateModel): Promise<UserResponseModel>;
}