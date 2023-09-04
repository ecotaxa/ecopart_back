import { UserRequesCreationtModel, UserRequestModel, UserResponseModel } from "../../../domain/entities/user";
import { AuthUserCredentialsModel } from "../../../domain/entities/auth";

export interface UserDataSource {
    create(user: UserRequesCreationtModel): Promise<number>;
    getAll(): Promise<UserResponseModel[]>;
    // deleteOne(id: String): void;
    // updateOne(id: String, data: UserRequesCreationtModel): void;
    getOne(user: UserRequestModel): Promise<UserResponseModel | null>;
    getUserLogin(email: string): Promise<AuthUserCredentialsModel | null>;
}