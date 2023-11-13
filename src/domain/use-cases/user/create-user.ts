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
        // If  unvalidated user with the associated email already exist : resend email 
        const preexistent_user = await this.userRepository.getUser({ email: user.email })

        if (preexistent_user && !preexistent_user.valid_email) {
            // generate validation token
            const confirmation_token = this.userRepository.generateValidationToken(preexistent_user)
            //delet confirmation_code from created user
            delete preexistent_user.confirmation_code;
            //send email    
            this.mailer.send_confirmation_email(this.transporter, preexistent_user, confirmation_token)
            return preexistent_user
        } else if (preexistent_user && preexistent_user.valid_email) {
            throw new Error("Valid user already exist")
            // Could sent an email to say that the user already exist
        } else if (preexistent_user === null) {
            // Create user
            const created_id = await this.userRepository.createUser(user)
            if (!created_id) throw new Error("Can't create user");

            //Get created user
            const created_user = await this.userRepository.getUser({ user_id: created_id })
            if (!created_user) throw new Error("Can't find created user");

            // Generate validation token
            const confirmation_token = this.userRepository.generateValidationToken(created_user)
            // Delet confirmation_code from created user
            delete created_user.confirmation_code;
            // Send email    
            this.mailer.send_confirmation_email(this.transporter, created_user, confirmation_token)
            return created_user
        } else {
            throw new Error("Can't create user");
        }
    }
}