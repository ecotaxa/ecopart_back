import { UserRequestModel, UserResponseModel } from "../../../domain/entities/user";

export interface UserDataSource {
    create(user: UserRequestModel): Promise<number>;
    getAll(): Promise<UserResponseModel[]>;
    // deleteOne(id: String): void;
    // updateOne(id: String, data: UserRequestModel): void;
    getOne(id: number): Promise<UserResponseModel | null>;
}