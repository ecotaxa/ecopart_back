import { UserResponseModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { GetAllUsersUseCase } from "../../interfaces/use-cases/user/get-all-users";

export class GetAllUsers implements GetAllUsersUseCase {
    userRepository: UserRepository
    constructor(userRepository: UserRepository) {
        this.userRepository = userRepository
    }

    async execute(): Promise<UserResponseModel[]> {
        // TODO 
        // User should not be deleted
        //if (await this.userRepository.isDeleted(userAuth.user_id)) throw new Error("User is deleted");

        const result = await this.userRepository.getUsers()
        const publicUsers = result.map(user => this.userRepository.toPublicUser(user))
        return publicUsers
    }
}