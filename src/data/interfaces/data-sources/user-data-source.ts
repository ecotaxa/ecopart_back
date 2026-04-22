import { UserRequestCreationModel, UserRequestModel, UserUpdateModel, UserResponseModel, UserSeedModel } from "../../../domain/entities/user";
import { AuthUserCredentialsModel } from "../../../domain/entities/auth";
import { PreparedSearchOptions, SearchResult } from "../../../domain/entities/search";

export interface UserDataSource {
    create(user: UserRequestCreationModel): Promise<number>;
    ensureSeedUser(user: UserSeedModel): Promise<void>;
    getAll(options: PreparedSearchOptions): Promise<SearchResult<UserResponseModel>>;
    updateOne(user: UserUpdateModel): Promise<number>;
    getOne(user: UserRequestModel): Promise<UserResponseModel | null>;
    getUserLogin(email: string): Promise<AuthUserCredentialsModel | null>;
    getDistinctOrganisations(): Promise<string[]>;
}