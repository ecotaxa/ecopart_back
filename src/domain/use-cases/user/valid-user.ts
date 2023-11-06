import { UserRepository } from "../../interfaces/repositories/user-repository";
import { ValidUserUseCase } from "../../interfaces/use-cases/user/valid-user";

export class ValidUser implements ValidUserUseCase {
    userRepository: UserRepository
    constructor(userRepository: UserRepository) {
        this.userRepository = userRepository
    }

    async execute(confirmation_code: string): Promise<void> {
        // find one user with confirmation code
        const user_to_update = await this.userRepository.getUser({ confirmation_code: confirmation_code })
        // if no user found throw error
        if (!user_to_update) throw new Error("Can't find user with confirmation code");
        // update validation status of the found user
        const nb_updated_user = await this.userRepository.validUser(user_to_update)
        // if no user updated throw error
        if (!nb_updated_user || nb_updated_user == 0) throw new Error("Can't update user");
        // if user updated get user
        const updated_user = await this.userRepository.getUser({ id: user_to_update.id })
        if (!updated_user) throw new Error("Can't get updated user");
        if (!updated_user.valid_email && confirmation_code !== undefined) throw new Error("Can't validate user");
    }
}