import { UserRepository } from "../../interfaces/repositories/user-repository";
import { ValidUserUseCase } from "../../interfaces/use-cases/user/valid-user";

export class ValidUser implements ValidUserUseCase {
    userRepository: UserRepository
    constructor(userRepository: UserRepository) {
        this.userRepository = userRepository
    }

    async execute(user_id: number, confirmation_token: string): Promise<void> {
        // Check if confirmation jwt is valid and decode it
        const decoded_token = this.userRepository.verifyValidationToken(confirmation_token)
        // If token not valid throw error
        if (!decoded_token) throw new Error("Invalid confirmation token");
        // Check if user_id in token is the same as user_id in params
        if (decoded_token.user_id != user_id) throw new Error("User vallidation forbidden");


        // Find user with confirmation code and user_id
        const user_to_update = await this.userRepository.getUser({ user_id: user_id, confirmation_code: decoded_token.confirmation_code })

        // If no user found throw error
        if (!user_to_update) throw new Error("Cannot find user with confirmation code");

        // User should not be deleted
        if (user_to_update.deleted) throw new Error("User is deleted");

        // Update validation status of the found user
        const nb_updated_user = await this.userRepository.validUser({ user_id: user_to_update.user_id })
        // If no user updated throw error
        if (nb_updated_user == 0) throw new Error("Cannot update user");

        // Get updated user 
        const updated_user = await this.userRepository.getUser({ user_id: user_to_update.user_id })
        if (!updated_user) throw new Error("Cannot find updated user");
        if (!updated_user.valid_email || updated_user.confirmation_code !== null) throw new Error("Cannot validate user");
    }
}