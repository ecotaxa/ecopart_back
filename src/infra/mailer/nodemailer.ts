import { MailerWrapper } from "./nodemailer-wrapper"
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

import { UserResponseModel } from "../../domain/entities/user";

export class NodemailerAdapter implements MailerWrapper {//implements sendeamils,  
    base_url_path: string;
    mail_sender: string;

    constructor(base_url_path: string, mail_sender: string) {
        this.base_url_path = base_url_path;
        this.mail_sender = mail_sender;
    }

    // createTransport
    async createTransport(transporter_options: any): Promise<Transporter> {
        const transporter = await nodemailer.createTransport(transporter_options)
        return transporter
    }

    // send confirmation email
    async send_confirmation_email(transporter: Transporter, created_user: UserResponseModel, confirmation_code: string): Promise<void> {

        // Read the HTML file
        let htmlContent = "error"
        try {
            const filePath = path.join(__dirname + "/templates/account_validation_email.html")
            htmlContent = fs.readFileSync(filePath, 'utf8');
        } catch (err) {
            console.error(err)
        }

        // prepare the custom confirmation path
        const custom_confirmation_path = this.base_url_path + "/users/" + created_user.user_id + "/welcome/" + confirmation_code
        const mail_sender = this.mail_sender

        // Send the email
        transporter.sendMail({
            from: mail_sender, // sender address
            to: "julie.coustenoble@imev-mer.fr", // TODO PROD : created_user.email,// list of receivers
            subject: "Validate your EcoPart account", // Subject line
            html: htmlContent.replaceAll("{{confirmation_path}}", custom_confirmation_path), // html body //TODO DYNAMIC URL
        }, (err, info) => {
            if (err) {
                console.log(err)
            } else {
                console.log('Email sent: ' + info.response)
            }
        });
    }

    async send_reset_password_email(transporter: nodemailer.Transporter, user: UserResponseModel, resetPasswordToken: string): Promise<void> {
        // Read the HTML file
        let htmlContent = "error"
        try {
            const filePath = path.join(__dirname + "/templates/reset_password_email.html")
            htmlContent = fs.readFileSync(filePath, 'utf8');
        } catch (err) {
            console.error(err)
        }

        // prepare the custom reset_password_path path
        const custom_reset_password_path = this.base_url_path + "/auth/password/reset/" + resetPasswordToken
        const mail_sender = this.mail_sender

        // Send the email
        transporter.sendMail({
            from: mail_sender, // sender address
            to: "julie.coustenoble@imev-mer.fr", // TODO PROD : user.email,// list of receivers
            subject: "Reset your EcoPart password", // Subject line
            html: htmlContent.replaceAll("{{reset_password_path}}", custom_reset_password_path), // html body //TODO DYNAMIC URL
        }, (err, info) => {
            if (err) {
                console.log(err)
            } else {
                console.log('Email sent: ' + info.response)
            }
        });
    }
}
