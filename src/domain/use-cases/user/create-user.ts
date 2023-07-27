import { UserRequestModel, UserResponseModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { CreateUserUseCase } from "../../interfaces/use-cases/user/create-user";

export class CreateUser implements CreateUserUseCase {
    userRepository: UserRepository
    constructor(userRepository: UserRepository) {
        this.userRepository = userRepository
    }

    async execute(user: UserRequestModel): Promise<UserResponseModel | null> {
        const created_id = await this.userRepository.createUser(user)
        const created_user = await this.userRepository.getUser(created_id)
        return created_user;
    }
}