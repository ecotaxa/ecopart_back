
import { AuthUserCredentialsModel, DecodedToken, ChangeCredentialsModel } from "../../entities/auth";
import { FilterSearchOptions, PreparedPaginedSearchOptions, PreparedSearchOptions, PreparedSortingSearchOptions, SearchResult } from "../../entities/search";
import { UserRequesCreationtModel, UserResponseModel, UserRequestModel, UserUpdateModel, PublicUserModel, PrivateUserModel } from "../../entities/user";
export interface UserRepository {
    formatFilters(filters: FilterSearchOptions[]): FilterSearchOptions[];
    formatSortBy(sort_by: string): PreparedSortingSearchOptions[];
    changePassword(user_to_update: ChangeCredentialsModel): Promise<number>;
    getUser(user: UserRequestModel): Promise<UserResponseModel | null>;
    adminUpdateUser(user: UserUpdateModel): Promise<number>;
    standardUpdateUser(user: UserUpdateModel): Promise<number>;
    verifyUserLogin(user: AuthUserCredentialsModel): Promise<boolean>;
    createUser(user: UserRequesCreationtModel): Promise<number>;
    adminGetUsers(options: PreparedSearchOptions | PreparedPaginedSearchOptions): Promise<SearchResult>;
    standardGetUsers(options: PreparedSearchOptions | PreparedPaginedSearchOptions): Promise<SearchResult>;
    isAdmin(user_id: number): Promise<boolean>;
    validUser(user: UserRequestModel): Promise<number>;
    generateValidationToken(user: UserRequestModel): string;
    verifyValidationToken(confirmation_token: string): DecodedToken | null;
    generateResetPasswordToken(user: UserRequestModel): string;
    verifyResetPasswordToken(reset_password_token: string): DecodedToken | null;
    setResetPasswordCode(user: UserUpdateModel): Promise<number>;
    toPublicUser(createdUser: PrivateUserModel): PublicUserModel;
    deleteUser(user: UserUpdateModel): Promise<number>;
    isDeleted(user_id: number): Promise<boolean>;
}