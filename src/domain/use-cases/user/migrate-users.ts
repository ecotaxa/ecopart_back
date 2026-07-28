import { Transporter } from "nodemailer";
import {
    UserUpdateModel,
    UserMigrationRequestModel,
    UserResponseModel,
    MigrateUsersResponseModel,
    UserMigrationResultModel,
    UserMigrationStatus
} from "../../entities/user";
import { UserRepository } from "../../interfaces/repositories/user-repository";
import { MigrateUsersUseCase } from "../../interfaces/use-cases/user/migrate-users";
import { MailerWrapper } from "../../../infra/mailer/nodemailer-wrapper";

export class MigrateUsers implements MigrateUsersUseCase {
    userRepository: UserRepository
    transporter: Transporter
    mailer: MailerWrapper

    constructor(userRepository: UserRepository, transporter: Transporter, mailer: MailerWrapper) {
        this.userRepository = userRepository
        this.transporter = transporter
        this.mailer = mailer
    }

    async execute(current_user: UserUpdateModel, users: UserMigrationRequestModel[], dry_run: boolean): Promise<MigrateUsersResponseModel> {
        // Authorization: only an admin (whose account is usable) may migrate users.
        await this.userRepository.ensureUserCanBeUsed(current_user.user_id);
        if (!await this.userRepository.isAdmin(current_user.user_id)) throw new Error("Logged user cannot migrate users");

        const results: UserMigrationResultModel[] = []
        for (const user of users) {
            try {
                results.push(await this.migrateOne(user, dry_run))
            } catch (err) {
                results.push({ email: user.email, legacy_ecopart_user_id: user.legacy_ecopart_user_id, status: "error", message: err.message })
            }
        }

        // Build the per-status summary
        const summary = { total: results.length } as MigrateUsersResponseModel["summary"]
        for (const result of results) {
            summary[result.status] = (summary[result.status] ?? 0) + 1
        }

        return { dry_run, summary, results }
    }

    private async migrateOne(user: UserMigrationRequestModel, dry_run: boolean): Promise<UserMigrationResultModel> {
        const result = (status: UserMigrationStatus, message?: string): UserMigrationResultModel =>
            ({ email: user.email, legacy_ecopart_user_id: user.legacy_ecopart_user_id, status, message })

        const preexistentUser = await this.userRepository.getUser({ email: user.email });

        if (preexistentUser) {
            const is_legacy = preexistentUser.legacy_ecopart_user_id !== null && preexistentUser.legacy_ecopart_user_id !== undefined
            if (is_legacy) {
                // Same email but a different old id → likely a data/export error: report as an error.
                if (preexistentUser.legacy_ecopart_user_id !== user.legacy_ecopart_user_id) {
                    throw new Error(`Email already linked to legacy id ${preexistentUser.legacy_ecopart_user_id}, not ${user.legacy_ecopart_user_id}`)
                }
                // Already migrated → nothing to do here. Re-sending the email is the dedicated
                // POST /users/migrate/resend endpoint's job, not this one.
                return result("skipped_already_migrated", "User already migrated (use /users/migrate/resend to re-send the email)")
            }
            // A real (non-legacy) account already uses this email: link the old id so their legacy
            // data can be mapped, but never touch their password or send an email.
            if (dry_run) return result("would_link")
            await this.userRepository.linkLegacyUser(preexistentUser.user_id, user.legacy_ecopart_user_id)
            return result("linked_existing_user")
        }

        // Brand new migrated user.
        if (dry_run) return result("would_create")
        const createdId = await this.userRepository.migrateUser(user);
        await this.setResetCodeAndSendEmail(createdId)
        return result("created")
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
