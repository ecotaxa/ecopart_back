import { Transporter } from "nodemailer";
import { UserRequestCreationModel, UserResponseModel } from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { CreateUserUseCase } from "../../interfaces/use-cases/user/create-user";
import { MailerWrapper } from "../../../infra/mailer/nodemailer-wrapper";

export class CreateUser implements CreateUserUseCase {
    userRepository: UserRepository
    transporter: Transporter
    mailer: MailerWrapper

    constructor(userRepository: UserRepository, transporter: Transporter, mailer: MailerWrapper) {
        this.transporter = transporter
        this.userRepository = userRepository
        this.mailer = mailer
    }
    async execute(user: UserRequestCreationModel): Promise<UserResponseModel> {
        // Retrieve a pre-existing user by email
        const preexistentUser = await this.userRepository.getUser({ email: user.email });

        // Check if a user with the given email already exists
        if (preexistentUser) {
            // User should not be deleted
            if (preexistentUser.deleted !== undefined) throw new Error("User is deleted");

            // If the user exists but hasn't validated their email
            if (!preexistentUser.valid_email) {
                // Update the preexisting user with new information
                const updateCount = await this.userRepository.standardUpdateUser({
                    user_id: preexistentUser.user_id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    organisation: user.organisation,
                    country: user.country,
                    user_planned_usage: user.user_planned_usage
                });
                if (updateCount === 0) { throw new Error("Cannot update preexistent user"); }

                // Update password
                await this.userRepository.changePassword({ user_id: preexistentUser.user_id, new_password: user.password })
                // Retrieve the updated user information
                const updatedUser = await this.userRepository.getUser({ user_id: preexistentUser.user_id });
                if (!updatedUser) { throw new Error("Cannot find updated preexistent user"); }

                await this.generateTokenAndSendEmail(updatedUser)

                // Remove the confirmation code from the user object before sending it
                const publicUser = this.userRepository.toPublicUser(updatedUser)

                return publicUser;
            } else {
                // If the user exists and has already validated their email
                throw new Error("Valid user already exists");
            }
        }

        // If no preexisting user is found, create a new user
        const createdId = await this.userRepository.createUser(user);

        // Retrieve the newly created user information
        const createdUser = await this.userRepository.getUser({ user_id: createdId });
        if (!createdUser) { throw new Error("Cannot find created user"); }

        this.generateTokenAndSendEmail(createdUser)
        // Remove the confirmation code from the user object before sending it
        const publicUser = this.userRepository.toPublicUser(createdUser)
        return publicUser;
    }

    private async generateTokenAndSendEmail(user: UserResponseModel): Promise<void> {
        // Generate a new confirmation token for the user
        const confirmationToken = this.userRepository.generateValidationToken(user);

        // Send a confirmation email to the user
        this.mailer.send_confirmation_email(this.transporter, user, confirmationToken);
    }

}
