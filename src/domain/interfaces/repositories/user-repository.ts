
import { AuthUserCredentialsModel, DecodedToken } from "../../entities/auth";
import { UserRequesCreationtModel, UserResponseModel, UserRequestModel, UserUpdateModel } from "../../entities/user";
export interface UserRepository {
    getUser(user: UserRequestModel): Promise<UserResponseModel | null>;
    adminUpdateUser(user: UserUpdateModel): Promise<number>
    standardUpdateUser(user: UserUpdateModel): Promise<number>
    verifyUserLogin(user: AuthUserCredentialsModel): Promise<boolean>;
    createUser(user: UserRequesCreationtModel): Promise<number>;
    getUsers(): Promise<UserResponseModel[]>;
    isAdmin(user_id: number): Promise<boolean>;
    validUser(user: UserRequestModel): Promise<number>;
    generateValidationToken(user: UserRequestModel): string;
    verifyValidationToken(confirmation_token: string): DecodedToken | null
}