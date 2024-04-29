import { UserRequestCreationtModel, UserResponseModel } from "../../../entities/user";
export interface CreateUserUseCase {
    execute(user: UserRequestCreationtModel): Promise<UserResponseModel>;
}

