import { UserRequesCreationtModel, UserResponseModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { CreateUserUseCase } from "../../interfaces/use-cases/user/create-user";

export class CreateUser implements CreateUserUseCase {
    userRepository: UserRepository
    constructor(userRepository: UserRepository) {
        this.userRepository = userRepository
    }

    async execute(user: UserRequesCreationtModel): Promise<UserResponseModel> {
        const created_id = await this.userRepository.createUser(user)
        if (!created_id) throw new Error("Can't create user");
        const created_user = await this.userRepository.getUser({ id: created_id })
        if (!created_user) throw new Error("Can't find created user"); // to make ts happy
        return created_user
    }
}