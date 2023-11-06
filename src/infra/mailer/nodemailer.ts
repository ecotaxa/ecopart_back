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
            const filePath = path.join(__dirname + "/account_validation_email.html")
            htmlContent = fs.readFileSync(filePath, 'utf8');
        } catch (err) {
            console.error(err)
        }

        // prepare the custom confirmation path
        const custom_confirmation_path = this.base_url_path + "/users/welcome/" + confirmation_code
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
}


