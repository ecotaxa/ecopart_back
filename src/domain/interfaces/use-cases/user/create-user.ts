import { UserRequestCreationModel, UserResponseModel } from "../../../entities/user";
export interface CreateUserUseCase {
    execute(user: UserRequestCreationModel): Promise<UserResponseModel>;
}

