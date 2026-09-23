import { MailerWrapper } from "./nodemailer-wrapper"
import * as nodemailer from 'nodemailer';
import { Transporter, SendMailOptions } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

import { UserResponseModel } from "../../domain/entities/user";

const TEMPLATES_FOLDER = path.join(__dirname, "templates")
const LOGO_PATH = path.join(TEMPLATES_FOLDER, "assets", "logo_ecopart_white.png")

// Content-ID of the inline logo. Referenced as `cid:<LOGO_CID>` by layout.html so the
// header image renders without relying on a public image host.
const LOGO_CID = "ecopart-logo"

// Public EcoPart website, used for the footer links and the "get a new link" hints.
const WEBSITE_URL = "https://ecopart.obs-vlfr.fr"

/** One transactional email: its subject line, inbox preview and body template. */
interface EmailContent {
    template: string
    subject: string
    // Preview line shown next to the subject in the inbox.
    preheader: string
    // Placeholder values injected in both the layout and the body template.
    values: Record<string, string>
    // Plain-text alternative, for clients that don't render HTML and for deliverability.
    text: string
}

export class NodemailerAdapter implements MailerWrapper {//implements sendeamils,
    base_url_path: string;
    mail_sender: string;
    node_env: string;
    TEST_MAIL_DEFAULT_RECIPIENT: string

    constructor(base_url_path: string, mail_sender: string, node_env: string, TEST_MAIL_DEFAULT_RECIPIENT: string) {
        this.base_url_path = base_url_path;
        this.mail_sender = mail_sender;
        this.node_env = node_env;
        this.TEST_MAIL_DEFAULT_RECIPIENT = TEST_MAIL_DEFAULT_RECIPIENT;
    }

    // createTransport
    async createTransport(transporter_options: any): Promise<Transporter> {
        const transporter = await nodemailer.createTransport(transporter_options)
        return transporter
    }

    // Outside PROD every email is diverted to TEST_MAIL_DEFAULT_RECIPIENT so tests never reach
    // real users. When that variable is not configured, fall back to the real address rather
    // than sending to an empty one — an unset test recipient used to silently break every
    // outgoing email on non-PROD environments.
    private recipientFor(real_email: string): string {
        if (this.node_env == "PROD") return real_email
        return this.TEST_MAIL_DEFAULT_RECIPIENT ? this.TEST_MAIL_DEFAULT_RECIPIENT : real_email
    }

    // User-provided values (first name) end up inside the HTML body, so they must be escaped.
    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
    }

    private greetingFor(user: UserResponseModel): string {
        const first_name = user.first_name ? user.first_name.trim() : ""
        return first_name ? "Hello " + first_name + "," : "Hello,"
    }

    /**
     * Replaces every `{{placeholder}}` in one pass, so a value that happens to contain
     * `{{...}}` (a first name, say) is never itself expanded. Unknown placeholders are
     * left untouched rather than blanked, which makes a template typo visible.
     */
    private fill(template: string, values: Record<string, string>): string {
        return template.replace(/\{\{(\w+)\}\}/g, (placeholder, key) =>
            Object.prototype.hasOwnProperty.call(values, key) ? values[key] : placeholder
        )
    }

    /** Wraps a body template in the shared branded layout. Returns null if either is unreadable. */
    private render(content: EmailContent): string | null {
        try {
            const layout = fs.readFileSync(path.join(TEMPLATES_FOLDER, "layout.html"), 'utf8')
            const body = fs.readFileSync(path.join(TEMPLATES_FOLDER, content.template), 'utf8')

            // The body is inserted first, then everything is filled in a single pass so the
            // body's own placeholders are resolved too.
            return this.fill(layout.replace("{{content}}", body), {
                ...content.values,
                title: content.subject,
                preheader: content.preheader,
                logo_src: "cid:" + LOGO_CID,
                website_url: WEBSITE_URL,
                year: String(new Date().getFullYear()),
            })
        } catch (err) {
            console.error(err)
            return null
        }
    }

    /**
     * Renders and sends one transactional email. A template that cannot be read degrades to
     * the plain-text alternative instead of mailing the user an "error" body, so an asset
     * problem never locks anyone out of their account.
     */
    private send(transporter: Transporter, user: UserResponseModel, content: EmailContent): void {
        const html = this.render(content)

        const mail: SendMailOptions = {
            from: this.mail_sender, // sender address
            to: this.recipientFor(user.email), // list of receivers
            subject: content.subject,
            text: content.text,
        }

        if (html) {
            mail.html = html
            // Inline (not "attached") so clients show it in the header rather than as a file.
            if (fs.existsSync(LOGO_PATH)) {
                mail.attachments = [{
                    filename: "logo_ecopart.png",
                    path: LOGO_PATH,
                    cid: LOGO_CID,
                    contentDisposition: "inline",
                }]
            }
        }

        transporter.sendMail(mail, (err, info) => {
            if (err) {
                console.log(err)
            } else {
                console.log('Email sent: ' + info.response)
            }
        });
    }

    // send confirmation email
    async send_confirmation_email(transporter: Transporter, created_user: UserResponseModel, confirmation_code: string): Promise<void> {
        // prepare the custom confirmation path
        const custom_confirmation_path = this.base_url_path + "/users/" + created_user.user_id + "/welcome/" + confirmation_code

        this.send(transporter, created_user, {
            template: "account_validation_email.html",
            subject: "Validate your EcoPart account",
            preheader: "Confirm your email address to activate your EcoPart account.",
            values: {
                greeting: this.escapeHtml(this.greetingFor(created_user)),
                confirmation_path: this.escapeHtml(custom_confirmation_path),
            },
            text: [
                this.greetingFor(created_user),
                "",
                "Welcome to EcoPart. Confirm your email address to activate your account:",
                custom_confirmation_path,
                "",
                "This link expires in 24 hours. If it has, register again on " + WEBSITE_URL + " to receive a new one.",
                "",
                "See you soon,",
                "The EcoPart team",
            ].join("\n"),
        })
    }

    async send_reset_password_email(transporter: nodemailer.Transporter, user: UserResponseModel, resetPasswordToken: string): Promise<void> {
        // prepare the custom reset_password_path path
        const custom_reset_password_path = this.base_url_path + "/auth/password/reset/" + resetPasswordToken

        this.send(transporter, user, {
            template: "reset_password_email.html",
            subject: "Reset your EcoPart password",
            preheader: "Choose a new password for your EcoPart account.",
            values: {
                greeting: this.escapeHtml(this.greetingFor(user)),
                reset_password_path: this.escapeHtml(custom_reset_password_path),
            },
            text: [
                this.greetingFor(user),
                "",
                "We received a request to reset the password of your EcoPart account. Choose a new one here:",
                custom_reset_password_path,
                "",
                "This link expires in 3 hours. If it has, request a new one from " + WEBSITE_URL + "/password/reset.",
                "You did not ask for this? You can safely ignore this email: your password stays unchanged.",
                "",
                "Best regards,",
                "The EcoPart team",
            ].join("\n"),
        })
    }

    async send_migration_email(transporter: nodemailer.Transporter, user: UserResponseModel, resetPasswordToken: string): Promise<void> {
        // prepare the custom reset_password_path path (reused to let migrated users set a password)
        const custom_reset_password_path = this.base_url_path + "/auth/password/reset/" + resetPasswordToken

        this.send(transporter, user, {
            template: "account_migration_email.html",
            subject: "Welcome to the new EcoPart: set your password",
            preheader: "Your EcoPart account has been migrated. Set a new password to get started.",
            values: {
                greeting: this.escapeHtml(this.greetingFor(user)),
                reset_password_path: this.escapeHtml(custom_reset_password_path),
            },
            text: [
                this.greetingFor(user),
                "",
                "EcoPart has moved to a brand new application, and your account came with it, along with your projects, samples and access rights.",
                "",
                "For security reasons your former password was not transferred. Set a new one to get started:",
                custom_reset_password_path,
                "",
                "This link expires in one week. If it has, request a new one from " + WEBSITE_URL + "/password/reset using this email address.",
                "",
                "Happy exploring,",
                "The EcoPart team",
            ].join("\n"),
        })
    }
}
