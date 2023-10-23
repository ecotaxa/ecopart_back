
import { AuthUserCredentialsModel } from "../../entities/auth";
import { UserRequesCreationtModel, UserResponseModel, UserRequestModel, UserUpdateModel } from "../../entities/user";
export interface UserRepository {
    getUser(user: UserRequestModel): Promise<UserResponseModel | null>;
    adminUpdateUser(user: UserUpdateModel): Promise<number | null>
    standardUpdateUser(user: UserUpdateModel): Promise<number | null>
    verifyUserLogin(user: AuthUserCredentialsModel): Promise<boolean>;
    createUser(user: UserRequesCreationtModel): Promise<number | null>;
    getUsers(): Promise<UserResponseModel[]>;
    isAdmin(id: number): Promise<boolean>
}