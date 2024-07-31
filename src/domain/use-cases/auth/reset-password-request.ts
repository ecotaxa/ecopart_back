import { Transporter } from "nodemailer";
import { UserRequestModel, UserResponseModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { ResetPasswordRequestUseCase } from "../../interfaces/use-cases/auth/reset-password-request";
import { MailerWrapper } from "../../../infra/mailer/nodemailer-wrapper";
//generateResetPasswordToken
export class ResetPasswordRequest implements ResetPasswordRequestUseCase {
    userRepository: UserRepository
    transporter: Transporter
    mailer: MailerWrapper

    constructor(userRepository: UserRepository, transporter: Transporter, mailer: MailerWrapper) {
        this.transporter = transporter
        this.userRepository = userRepository
        this.mailer = mailer
    }

    async execute(user: UserRequestModel): Promise<void> {

        // Does the user exist ?
        const preexistant_user = await this.userRepository.getUser(user)
        if (!preexistant_user) throw new Error("User does not exist");

        // User should not be deleted nor unvalidated
        await this.userRepository.ensureUserCanBeUsed(preexistant_user.user_id);

        // Generate a reset password token and add it to the user
        const updateCount = await this.userRepository.setResetPasswordCode({ user_id: preexistant_user.user_id })
        if (updateCount === 0) throw new Error("Cannot set password reset code");

        // Retrieve the updated user information
        const updatedUser = await this.userRepository.getUser({ user_id: preexistant_user.user_id });
        if (!updatedUser) throw new Error("Cannot find updated user");

        // Generate token and send reset password email
        this.generateTokenAndSendEmail(updatedUser)

    }

    private async generateTokenAndSendEmail(user: UserResponseModel): Promise<void> {
        // Generate a new reset password token for the user
        const resetPasswordToken = this.userRepository.generateResetPasswordToken(user);

        // Send a reset password email to the user
        this.mailer.send_reset_password_email(this.transporter, user, resetPasswordToken);
    }
}
