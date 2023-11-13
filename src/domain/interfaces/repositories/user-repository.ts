
import { AuthUserCredentialsModel, DecodedToken } from "../../entities/auth";
import { UserRequesCreationtModel, UserResponseModel, UserRequestModel, UserUpdateModel } from "../../entities/user";
export interface UserRepository {
    getUser(user: UserRequestModel): Promise<UserResponseModel | null>;
    adminUpdateUser(user: UserUpdateModel): Promise<number | null>
    standardUpdateUser(user: UserUpdateModel): Promise<number | null>
    verifyUserLogin(user: AuthUserCredentialsModel): Promise<boolean>;
    createUser(user: UserRequesCreationtModel): Promise<number | null>;
    getUsers(): Promise<UserResponseModel[]>;
    isAdmin(user_id: number): Promise<boolean>;
    validUser(user: UserRequestModel): Promise<number | null>;
    generateValidationToken(user: UserRequestModel): string;
    verifyValidationToken(confirmation_token: string): DecodedToken | null
}