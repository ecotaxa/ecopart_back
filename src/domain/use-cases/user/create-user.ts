import { Transporter } from "nodemailer";
import { UserRequesCreationtModel, UserResponseModel } from "../../entities/user";
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
    async execute(user: UserRequesCreationtModel): Promise<UserResponseModel> {
        // Retrieve a pre-existing user by email
        const preexistentUser = await this.userRepository.getUser({ email: user.email });

        // Check if a user with the given email already exists
        if (preexistentUser) {
            // If the user exists but hasn't validated their email
            if (!preexistentUser.valid_email) {
                // Update the preexisting user with new information
                const updateCount = await this.userRepository.standardUpdateUser(preexistentUser);
                if (updateCount === 0) { throw new Error("Can't update preexistent user"); }

                // Retrieve the updated user information
                const updatedUser = await this.userRepository.getUser({ user_id: preexistentUser.user_id });
                if (!updatedUser) { throw new Error("Can't find updated preexistent user"); }

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
        if (!createdUser) { throw new Error("Can't find created user"); }

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