
import { AuthUserCredentialsModel } from "../../entities/auth";
import { UserRequesCreationtModel, UserResponseModel, UserRequestModel } from "../../entities/user";
export interface UserRepository {
    getUser(user: UserRequestModel): Promise<UserResponseModel | null>;
    verifyUserLogin(user: AuthUserCredentialsModel): Promise<boolean>;
    createUser(user: UserRequesCreationtModel): Promise<number | null>;
    getUsers(): Promise<UserResponseModel[]>;
}