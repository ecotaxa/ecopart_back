import { Transporter } from "nodemailer";
import {
    UserUpdateModel,
    UserResponseModel,
    MigrateUsersResponseModel,
    UserMigrationResultModel
} from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { ResendMigrationEmailsUseCase } from "../../interfaces/use-cases/user/resend-migration-emails";
import { MailerWrapper } from "../../../infra/mailer/nodemailer-wrapper";

export class ResendMigrationEmails implements ResendMigrationEmailsUseCase {
    userRepository: UserRepository
    transporter: Transporter
    mailer: MailerWrapper

    constructor(userRepository: UserRepository, transporter: Transporter, mailer: MailerWrapper) {
        this.userRepository = userRepository
        this.transporter = transporter
        this.mailer = mailer
    }

    async execute(current_user: UserUpdateModel, dry_run: boolean): Promise<MigrateUsersResponseModel> {
        // Authorization: only an admin (whose account is usable) may resend migration emails.
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        if (!await this.userRepository.isAdmin(current_user.user_id)) throw new Error("Logged user cannot migrate users");

        const users = await this.userRepository.getLegacyUsersWithoutPassword();

        const results: UserMigrationResultModel[] = []
        for (const user of users) {
            const base = { email: user.email, legacy_ecopart_user_id: user.legacy_ecopart_user_id as number }
            try {
                if (dry_run) {
                    results.push({ ...base, status: "would_resend" })
                } else {
                    await this.setResetCodeAndSendEmail(user.user_id)
                    results.push({ ...base, status: "email_resent" })
                }
            } catch (err) {
                results.push({ ...base, status: "error", message: err.message })
            }
        }

        const summary = { total: results.length } as MigrateUsersResponseModel["summary"]
        for (const result of results) {
            summary[result.status] = (summary[result.status] ?? 0) + 1
        }

        return { dry_run, summary, results }
    }

    private async setResetCodeAndSendEmail(user_id: number): Promise<void> {
        const updateCount = await this.userRepository.setResetPasswordCode({ user_id })
        if (updateCount === 0) throw new Error("Cannot set password reset code");

        const updatedUser = await this.userRepository.getUser({ user_id });
        if (!updatedUser) throw new Error("Cannot find migrated user");

        // Migrated users may not act immediately, so give them a one-week window to set their password.
        const resetPasswordToken = this.userRepository.generateResetPasswordToken(updatedUser, '7d');
        await this.mailer.send_migration_email(this.transporter, updatedUser as UserResponseModel, resetPasswordToken);
    }
}
