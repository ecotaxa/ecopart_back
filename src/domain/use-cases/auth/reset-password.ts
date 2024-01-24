import { UserRepository } from "../../interfaces/repositories/user-repository";
import { ResetPasswordUseCase } from "../../interfaces/use-cases/auth/reset-password";
import { ChangeCredentialsModel, DecodedToken } from "../../entities/auth";
import { UserResponseModel } from "../../entities/user";

export class ResetPassword implements ResetPasswordUseCase {
    userRepository: UserRepository

    constructor(userRepository: UserRepository) {
        this.userRepository = userRepository
    }
    async execute(credentials: ChangeCredentialsModel): Promise<void> {
        let nb_of_updated_user: number = 0
        let decoded_token: DecodedToken | null = null

        //is the user reset_password_token valid ?
        if (credentials.reset_password_token) {
            decoded_token = this.userRepository.verifyResetPasswordToken(credentials.reset_password_token)
            if (!decoded_token) throw new Error("Token is not valid");
        } else throw new Error("Token is not valid");

        // does the user bind to reset_password_code exist ?
        const preexistant_user: UserResponseModel | null = await this.userRepository.getUser(
            {
                user_id: decoded_token.user_id,
                reset_password_code: decoded_token.reset_password_code
            }
        )
        // if the user does not exist or the reset_password_code is not valid
        if (!preexistant_user) throw new Error("User does not exist or token is not valid");

        // is the user validated ?
        if (!preexistant_user.valid_email) throw new Error("User email is not validated");

        // change the password
        nb_of_updated_user = await this.userRepository.changePassword({ ...preexistant_user, ...credentials })
        if (nb_of_updated_user == 0) throw new Error("Can't change password");
    }
}