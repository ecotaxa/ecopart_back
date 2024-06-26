
import { AuthUserCredentialsModel, DecodedToken, ChangeCredentialsModel } from "../../entities/auth";
import { PaginedSearchOptions, PreparedSearchOptions, SearchResult } from "../../entities/search";
import { UserRequestCreationModel, UserResponseModel, UserRequestModel, UserUpdateModel, PublicUserModel, PrivateUserModel } from "../../entities/user";
export interface UserRepository {
    changePassword(user_to_update: ChangeCredentialsModel): Promise<number>;
    getUser(user: UserRequestModel): Promise<UserResponseModel | null>;
    adminUpdateUser(user: UserUpdateModel): Promise<number>;
    standardUpdateUser(user: UserUpdateModel): Promise<number>;
    verifyUserLogin(user: AuthUserCredentialsModel): Promise<boolean>;
    createUser(user: UserRequestCreationModel): Promise<number>;
    adminGetUsers(options: PreparedSearchOptions | PaginedSearchOptions): Promise<SearchResult<UserResponseModel>>;
    standardGetUsers(options: PreparedSearchOptions | PaginedSearchOptions): Promise<SearchResult<UserResponseModel>>;
    isAdmin(user_id: number): Promise<boolean>;
    validUser(user: UserRequestModel): Promise<number>;
    generateValidationToken(user: UserRequestModel): string;
    verifyValidationToken(confirmation_token: string): DecodedToken | null;
    generateResetPasswordToken(user: UserRequestModel): string;
    verifyResetPasswordToken(reset_password_token: string): DecodedToken | null;
    setResetPasswordCode(user: UserUpdateModel): Promise<number>;
    toPublicUser(createdUser: PrivateUserModel): PublicUserModel;
    deleteUser(user: UserUpdateModel): Promise<number>;
    isDeleted(user: UserResponseModel | null): Promise<boolean>;
    isValidated(user: UserResponseModel | null): Promise<boolean>;
    canUserBeUse(user_id: number): Promise<boolean>
    ensureUserCanBeUsed(user_id: number): Promise<void>;
    ensureTypedUserCanBeUsed(user_id: number, userType: string): Promise<void>
}