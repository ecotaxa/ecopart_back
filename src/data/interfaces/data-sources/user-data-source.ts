import { UserRequestCreationtModel, UserRequestModel, UserUpdateModel, UserResponseModel } from "../../../domain/entities/user";
import { AuthUserCredentialsModel } from "../../../domain/entities/auth";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

export interface UserDataSource {
    create(user: UserRequestCreationtModel): Promise<number>;
    getAll(options: PreparedSearchOptions): Promise<SearchResult>;
    updateOne(user: UserUpdateModel): Promise<number>;
    getOne(user: UserRequestModel): Promise<UserResponseModel | null>;
    getUserLogin(email: string): Promise<AuthUserCredentialsModel | null>;
}