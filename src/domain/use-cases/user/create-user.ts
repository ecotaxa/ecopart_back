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
                delete updatedUser.confirmation_code;
                return updatedUser;
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
        delete createdUser.confirmation_code;
        return createdUser;
    }

    private async generateTokenAndSendEmail(user: UserResponseModel): Promise<void> {
        // Generate a new confirmation token for the user
        const confirmationToken = this.userRepository.generateValidationToken(user);
        // Remove the confirmation code from the user object before sending it
        delete user.confirmation_code;
        // Send a confirmation email to the user
        this.mailer.send_confirmation_email(this.transporter, user, confirmationToken);
    }


    // async execute(user: UserRequesCreationtModel): Promise<UserResponseModel> {
    //     // If  unvalidated user with the associated email already exist : resend email 
    //     const preexistent_user = await this.userRepository.getUser({ email: user.email })

    //     if (preexistent_user && !preexistent_user.valid_email) {
    //         // Generate validation token
    //         // Update preexistent user with new information
    //         const updated_user_nb = await this.userRepository.standardUpdateUser(preexistent_user)
    //         if (updated_user_nb === 0) throw new Error("Can't update preexistant user");
    //         // Get updated user
    //         const updated_user = await this.userRepository.getUser({ user_id: preexistent_user.user_id })
    //         if (!updated_user) throw new Error("Can't find updated preexistant user");
    //         // Generate confirmation token
    //         const confirmation_token = this.userRepository.generateValidationToken(preexistent_user)
    //         // Delet confirmation_code from created user
    //         delete preexistent_user.confirmation_code;
    //         // And email    
    //         this.mailer.send_confirmation_email(this.transporter, preexistent_user, confirmation_token)
    //         return preexistent_user
    //     } else if (preexistent_user && preexistent_user.valid_email) {
    //         throw new Error("Valid user already exist")
    //         // Could sent an email to say that the user already exist
    //     } else if (preexistent_user === null) {
    //         // Create user
    //         const created_id = await this.userRepository.createUser(user)
    //         if (!created_id) throw new Error("Can't create user");

    //         // Get created user
    //         const created_user = await this.userRepository.getUser({ user_id: created_id })
    //         if (!created_user) throw new Error("Can't find created user");

    //         // Generate validation token
    //         const confirmation_token = this.userRepository.generateValidationToken(created_user)
    //         // Delet confirmation_code from created user
    //         delete created_user.confirmation_code;
    //         // Send email    
    //         this.mailer.send_confirmation_email(this.transporter, created_user, confirmation_token)
    //         return created_user
    //     } else {
    //         throw new Error("Can't create user");
    //     }
    // }
}