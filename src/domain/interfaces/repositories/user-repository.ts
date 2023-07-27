import { UserResponseModel, UserRequestModel } from "../../entities/user";
export interface UserRepository {
    getUser(created_id: number): Promise<UserResponseModel | null>;
    createUser(user: UserRequestModel): Promise<number>;
    getUsers(): Promise<UserResponseModel[]>;
}