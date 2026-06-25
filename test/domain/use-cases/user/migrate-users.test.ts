import { Transporter } from "nodemailer";
import { UserMigrationRequestModel, UserResponseModel, UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { MigrateUsers } from '../../../../src/domain/use-cases/user/migrate-users'
import { NodemailerAdapter } from '../../../../src/infra/mailer/nodemailer'
import { MailerWrapper } from "../../../../src/infra/mailer/nodemailer-wrapper";
import { MockUserRepository } from "../../../mocks/user-mock";

describe("Migrate Users Use Case", () => {
    let mockUserRepository: UserRepository;
    let mockTransporter: Transporter;
    let mockMailerAdapter: MailerWrapper;
    let migrateUsersUseCase: MigrateUsers;

    const admin: UserUpdateModel = { user_id: 1 }

    const InputUser: UserMigrationRequestModel = {
        legacy_ecopart_user_id: 4321,
        last_name: "Smith",
        first_name: "John",
        email: "john@gmail.com",
        organisation: "LOV",
        country: "France",
        user_planned_usage: "Research"
    }

    const migratedUser: UserResponseModel = {
        user_id: 10,
        last_name: "Smith",
        first_name: "John",
        email: "john@gmail.com",
        is_admin: false,
        valid_email: true,
        organisation: "LOV",
        country: "France",
        user_planned_usage: "Research",
        user_creation_utc_date_time: '2023-08-01 10:30:00',
        legacy_ecopart_user_id: 4321,
        legacy_password_set: false,
        reset_password_code: "reset_code"
    }

    beforeEach(async () => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository();
        mockMailerAdapter = new NodemailerAdapter("http://localhost:3000", "your@mail.com", "TEST", "test@test.com");
        mockTransporter = await mockMailerAdapter.createTransport({
            host: 'smtp.example.com', port: 465, secure: true, auth: { user: "u", pass: "p" },
        })
        migrateUsersUseCase = new MigrateUsers(mockUserRepository, mockTransporter, mockMailerAdapter)
    })

    test("Rejects when the current user is not an admin", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false)
        const getUserSpy = jest.spyOn(mockUserRepository, "getUser")

        await expect(migrateUsersUseCase.execute(admin, [InputUser], false))
            .rejects.toStrictEqual(new Error("Logged user cannot migrate users"))
        expect(getUserSpy).not.toBeCalled()
    })

    test("dry_run does not create users nor send emails", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true)
        jest.spyOn(mockUserRepository, "getUser").mockResolvedValue(null)
        const migrateSpy = jest.spyOn(mockUserRepository, "migrateUser").mockResolvedValue(10)
        const mailSpy = jest.spyOn(mockMailerAdapter, "send_migration_email").mockResolvedValue()

        const report = await migrateUsersUseCase.execute(admin, [InputUser], true)

        expect(report.dry_run).toBe(true)
        expect(report.results[0].status).toBe("would_create")
        expect(report.summary).toEqual({ total: 1, would_create: 1 })
        expect(migrateSpy).not.toBeCalled()
        expect(mailSpy).not.toBeCalled()
    })

    test("Creates a new migrated user and sends the migration email", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true)
        // first lookup by email -> none; second lookup by user_id after create -> migratedUser
        jest.spyOn(mockUserRepository, "getUser")
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(migratedUser)
        const migrateSpy = jest.spyOn(mockUserRepository, "migrateUser").mockResolvedValue(10)
        jest.spyOn(mockUserRepository, "setResetPasswordCode").mockResolvedValue(1)
        jest.spyOn(mockUserRepository, "generateResetPasswordToken").mockReturnValue("token")
        const mailSpy = jest.spyOn(mockMailerAdapter, "send_migration_email").mockResolvedValue()

        const report = await migrateUsersUseCase.execute(admin, [InputUser], false)

        expect(migrateSpy).toBeCalledWith(InputUser)
        expect(mockUserRepository.setResetPasswordCode).toBeCalledWith({ user_id: 10 })
        expect(mailSpy).toBeCalledWith(mockTransporter, migratedUser, "token")
        expect(report.results[0].status).toBe("created")
        expect(report.summary).toEqual({ total: 1, created: 1 })
    })

    test("Skips an already-migrated legacy user without re-sending (resend is a separate endpoint)", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true)
        // legacy user that exists, same id, password NOT set yet
        jest.spyOn(mockUserRepository, "getUser").mockResolvedValue(migratedUser)
        const migrateSpy = jest.spyOn(mockUserRepository, "migrateUser").mockResolvedValue(10)
        const setSpy = jest.spyOn(mockUserRepository, "setResetPasswordCode").mockResolvedValue(1)
        const mailSpy = jest.spyOn(mockMailerAdapter, "send_migration_email").mockResolvedValue()

        const report = await migrateUsersUseCase.execute(admin, [InputUser], false)

        expect(migrateSpy).not.toBeCalled()
        expect(setSpy).not.toBeCalled()
        expect(mailSpy).not.toBeCalled()
        expect(report.results[0].status).toBe("skipped_already_migrated")
    })

    test("Skips a legacy user who already set their password", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true)
        jest.spyOn(mockUserRepository, "getUser").mockResolvedValue({ ...migratedUser, legacy_password_set: true })
        const migrateSpy = jest.spyOn(mockUserRepository, "migrateUser").mockResolvedValue(10)
        const mailSpy = jest.spyOn(mockMailerAdapter, "send_migration_email").mockResolvedValue()

        const report = await migrateUsersUseCase.execute(admin, [InputUser], false)

        expect(migrateSpy).not.toBeCalled()
        expect(mailSpy).not.toBeCalled()
        expect(report.results[0].status).toBe("skipped_already_migrated")
    })

    test("Links the old id to a pre-existing non-legacy account, without emailing", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true)
        jest.spyOn(mockUserRepository, "getUser").mockResolvedValue({ ...migratedUser, legacy_ecopart_user_id: null, legacy_password_set: null })
        const migrateSpy = jest.spyOn(mockUserRepository, "migrateUser").mockResolvedValue(10)
        const linkSpy = jest.spyOn(mockUserRepository, "linkLegacyUser").mockResolvedValue(1)
        const mailSpy = jest.spyOn(mockMailerAdapter, "send_migration_email").mockResolvedValue()

        const report = await migrateUsersUseCase.execute(admin, [InputUser], false)

        expect(migrateSpy).not.toBeCalled()
        expect(linkSpy).toBeCalledWith(10, 4321)
        expect(mailSpy).not.toBeCalled()
        expect(report.results[0].status).toBe("linked_existing_user")
    })

    test("Reports an error when a legacy email is already linked to a different old id", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true)
        jest.spyOn(mockUserRepository, "getUser").mockResolvedValue({ ...migratedUser, legacy_ecopart_user_id: 1111 })
        const linkSpy = jest.spyOn(mockUserRepository, "linkLegacyUser").mockResolvedValue(1)
        const mailSpy = jest.spyOn(mockMailerAdapter, "send_migration_email").mockResolvedValue()

        const report = await migrateUsersUseCase.execute(admin, [InputUser], false)

        expect(linkSpy).not.toBeCalled()
        expect(mailSpy).not.toBeCalled()
        expect(report.results[0].status).toBe("error")
        expect(report.results[0].message).toBe("Email already linked to legacy id 1111, not 4321")
    })

    test("One failing row does not abort the batch", async () => {
        const secondUser: UserMigrationRequestModel = { ...InputUser, email: "jane@gmail.com", legacy_ecopart_user_id: 9999 }
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true)
        // first user: lookup throws; second user: not found then found
        jest.spyOn(mockUserRepository, "getUser")
            .mockRejectedValueOnce(new Error("DB error"))
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ ...migratedUser, email: "jane@gmail.com" })
        jest.spyOn(mockUserRepository, "migrateUser").mockResolvedValue(11)
        jest.spyOn(mockUserRepository, "setResetPasswordCode").mockResolvedValue(1)
        jest.spyOn(mockUserRepository, "generateResetPasswordToken").mockReturnValue("token")
        jest.spyOn(mockMailerAdapter, "send_migration_email").mockResolvedValue()

        const report = await migrateUsersUseCase.execute(admin, [InputUser, secondUser], false)

        expect(report.results[0].status).toBe("error")
        expect(report.results[0].message).toBe("DB error")
        expect(report.results[1].status).toBe("created")
        expect(report.summary).toEqual({ total: 2, error: 1, created: 1 })
    })
})
