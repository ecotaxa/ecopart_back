import { UserRequestModel, UserResponseModel } from "../../../entities/user";
export interface CreateUserUseCase {
    execute(user: UserRequestModel): Promise<UserResponseModel | null>;
}

