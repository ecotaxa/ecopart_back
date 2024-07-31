import { UserRepository } from "../../interfaces/repositories/user-repository";
import { ResetPasswordUseCase } from "../../interfaces/use-cases/auth/reset-password";
import { DecodedToken, ResetCredentialsModel } from "../../entities/auth";
import { UserResponseModel } from "../../entities/user";

export class ResetPassword implements ResetPasswordUseCase {
    userRepository: UserRepository

    constructor(userRepository: UserRepository) {
        this.userRepository = userRepository
    }
    async execute(credentials: ResetCredentialsModel): Promise<void> {
        let nb_of_updated_user: number = 0
        let decoded_token: DecodedToken | null = null

        // Is the user reset_password_token valid ?
        if (credentials.reset_password_token) {
            decoded_token = this.userRepository.verifyResetPasswordToken(credentials.reset_password_token)
            if (!decoded_token) throw new Error("Token is not valid");
            // User should not be deleted or invalid
            await this.userRepository.ensureUserCanBeUsed(decoded_token.user_id);
        } else throw new Error("No token provided");

        // Does the user bind to reset_password_code exist ?
        const preexistant_user: UserResponseModel | null = await this.userRepository.getUser(
            {
                user_id: decoded_token.user_id,
                reset_password_code: decoded_token.reset_password_code
            }
        )
        // If the user reset_password_code is not valid
        if (!preexistant_user) throw new Error("User does not exist or reset_password_code is not valid");

        // Change the password
        nb_of_updated_user = await this.userRepository.changePassword({ ...preexistant_user, ...credentials })
        if (nb_of_updated_user == 0) throw new Error("Cannot change password");
    }
}