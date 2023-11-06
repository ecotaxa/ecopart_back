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
        // TODO if email already exist and is ot valid resend email 
        // TODO try user.isvalid()
        const created_id = await this.userRepository.createUser(user)
        if (!created_id) throw new Error("Can't create user");
        const created_user = await this.userRepository.getUser({ id: created_id })
        if (!created_user) throw new Error("Can't find created user");

        //todo send email
        const confirmation_code = created_user.confirmation_code || "error";

        //delet confirmation_code from created user
        delete created_user.confirmation_code;
        //send email    
        this.mailer.send_confirmation_email(this.transporter, created_user, confirmation_code)
        return created_user
    }
}