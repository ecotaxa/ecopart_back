import { Transporter } from "nodemailer";
import { UserResponseModel } from "../../domain/entities/user";

export interface MailerWrapper {
    // TODO  : TransportOptions instead of any
    createTransport(transporter_options: any): Promise<Transporter>;
    // createTransport(transporter_options: TransportOptions): Promise<Transporter>;
    // sendMail(plaintext: string, digest: string): Promise<>;
    send_confirmation_email(transporter: Transporter, created_user: UserResponseModel, confirmation_code: string): Promise<void>
}