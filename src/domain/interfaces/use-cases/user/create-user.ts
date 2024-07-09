import { UserRequestCreationModel } from "../../../entities/user";
export interface CreateUserUseCase {
    execute(user: UserRequestCreationModel): Promise<void>;
}

