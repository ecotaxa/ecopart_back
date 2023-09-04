import { UserRequesCreationtModel, UserResponseModel } from "../../../entities/user";
export interface CreateUserUseCase {
    execute(user: UserRequesCreationtModel): Promise<UserResponseModel>;
}

