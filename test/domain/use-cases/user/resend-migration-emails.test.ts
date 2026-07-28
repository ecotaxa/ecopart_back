import { Transporter } from "nodemailer";
import { UserResponseModel, UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { ResendMigrationEmails } from '../../../../src/domain/use-cases/user/resend-migration-emails'
import { NodemailerAdapter } from '../../../../src/infra/mailer/nodemailer'
import { MailerWrapper } from "../../../../src/infra/mailer/nodemailer-wrapper";
import { MockUserRepository } from "../../../mocks/user-mock";

describe("Resend Migration Emails Use Case", () => {
    let mockUserRepository: UserRepository;
    let mockTransporter: Transporter;
    let mockMailerAdapter: MailerWrapper;
    let useCase: ResendMigrationEmails;

    const admin: UserUpdateModel = { user_id: 1 }

    const legacyUser = (user_id: number, email: string): UserResponseModel => ({
        user_id,
        last_name: "Smith",
        first_name: "John",
        email,
        is_admin: false,
        valid_email: true,
        organisation: "LOV",
        country: "France",
        user_planned_usage: "Research",
        user_creation_utc_date_time: '2023-08-01 10:30:00',
        legacy_ecopart_user_id: 4000 + user_id,
        legacy_password_set: false,
        reset_password_code: "reset_code"
    })

    beforeEach(async () => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository();
        mockMailerAdapter = new NodemailerAdapter("http://localhost:3000", "your@mail.com", "TEST", "test@test.com");
        mockTransporter = await mockMailerAdapter.createTransport({
            host: 'smtp.example.com', port: 465, secure: true, auth: { user: "u", pass: "p" },
        })
        useCase = new ResendMigrationEmails(mockUserRepository, mockTransporter, mockMailerAdapter)
    })

    test("Rejects when the current user is not an admin", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false)
        const listSpy = jest.spyOn(mockUserRepository, "getLegacyUsersWithoutPassword")

        await expect(useCase.execute(admin, false))
            .rejects.toStrictEqual(new Error("Logged user cannot migrate users"))
        expect(listSpy).not.toBeCalled()
    })

    test("Resends to every legacy user without a password", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true)
        jest.spyOn(mockUserRepository, "getLegacyUsersWithoutPassword").mockResolvedValue([legacyUser(10, "a@x.org"), legacyUser(11, "b@x.org")])
        jest.spyOn(mockUserRepository, "setResetPasswordCode").mockResolvedValue(1)
        jest.spyOn(mockUserRepository, "getUser").mockImplementation((u) => Promise.resolve(legacyUser(u.user_id as number, "x@x.org")))
        jest.spyOn(mockUserRepository, "generateResetPasswordToken").mockReturnValue("token")
        const mailSpy = jest.spyOn(mockMailerAdapter, "send_migration_email").mockResolvedValue()

        const report = await useCase.execute(admin, false)

        expect(mailSpy).toBeCalledTimes(2)
        expect(report.summary).toEqual({ total: 2, email_resent: 2 })
        expect(report.results.every(r => r.status === "email_resent")).toBe(true)
    })

    test("dry_run lists recipients without sending", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true)
        jest.spyOn(mockUserRepository, "getLegacyUsersWithoutPassword").mockResolvedValue([legacyUser(10, "a@x.org")])
        const setSpy = jest.spyOn(mockUserRepository, "setResetPasswordCode").mockResolvedValue(1)
        const mailSpy = jest.spyOn(mockMailerAdapter, "send_migration_email").mockResolvedValue()

        const report = await useCase.execute(admin, true)

        expect(setSpy).not.toBeCalled()
        expect(mailSpy).not.toBeCalled()
        expect(report.dry_run).toBe(true)
        expect(report.results[0].status).toBe("would_resend")
    })

    test("One failing recipient does not abort the batch", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true)
        jest.spyOn(mockUserRepository, "getLegacyUsersWithoutPassword").mockResolvedValue([legacyUser(10, "a@x.org"), legacyUser(11, "b@x.org")])
        jest.spyOn(mockUserRepository, "setResetPasswordCode")
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValueOnce(1)
        jest.spyOn(mockUserRepository, "getUser").mockImplementation((u) => Promise.resolve(legacyUser(u.user_id as number, "x@x.org")))
        jest.spyOn(mockUserRepository, "generateResetPasswordToken").mockReturnValue("token")
        jest.spyOn(mockMailerAdapter, "send_migration_email").mockResolvedValue()

        const report = await useCase.execute(admin, false)

        expect(report.summary).toEqual({ total: 2, error: 1, email_resent: 1 })
    })
})
