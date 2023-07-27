import { UserResponseModel } from "../../../entities/user";
export interface GetAllUsersUseCase {
    execute(): Promise<UserResponseModel[]>;
}