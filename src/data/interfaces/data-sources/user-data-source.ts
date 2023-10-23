import { UserRequesCreationtModel, UserRequestModel, UserUpdateModel, UserResponseModel } from "../../../domain/entities/user";
import { AuthUserCredentialsModel } from "../../../domain/entities/auth";

export interface UserDataSource {
    create(user: UserRequesCreationtModel): Promise<number>;
    getAll(): Promise<UserResponseModel[]>;
    deleteOne(id: string): void;
    updateOne(user: UserUpdateModel): Promise<number>;
    getOne(user: UserRequestModel): Promise<UserResponseModel | null>;
    getUserLogin(email: string): Promise<AuthUserCredentialsModel | null>;
}