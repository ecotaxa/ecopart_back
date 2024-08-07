
import { UserRequestModel, UserResponseModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { ResetPasswordRequest } from '../../../../src/domain/use-cases/auth/reset-password-request'

import { Transporter } from "nodemailer";
import { NodemailerAdapter } from '../../../../src/infra/mailer/nodemailer'
import { MailerWrapper } from "../../../../src/infra/mailer/nodemailer-wrapper";
import { MockUserRepository } from "../../../mocks/user-mock";

describe("Change password Use Case", () => {

    let mockUserRepository: UserRepository;
    let mockTransporter: Transporter;
    let mockMailerAdapter: MailerWrapper;


    const config = {
        TEST_VALIDATION_TOKEN_SECRET: process.env.TEST_VALIDATION_TOKEN_SECRET || '',
        TEST_MAIL_HOST: 'smtp.example.com',
        TEST_MAIL_PORT: 465,
        TEST_MAIL_SECURE: true,
        TEST_MAIL_AUTH_USER: "your_username",
        TEST_MAIL_AUTH_PASS: "your_password",
        TEST_MAIL_SENDER: "your@mail.com",
        TEST_PORT_LOCAL: 3000,
        TEST_BASE_URL_LOCAL: "http://localhost:",
        TEST_NODE_ENV: "TEST"
    }
    beforeEach(async () => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository()
        mockMailerAdapter = new NodemailerAdapter((config.TEST_BASE_URL_LOCAL + config.TEST_PORT_LOCAL), config.TEST_MAIL_SENDER, config.TEST_NODE_ENV)
        mockTransporter = await mockMailerAdapter.createTransport({
            host: config.TEST_MAIL_HOST,
            port: config.TEST_MAIL_PORT,
            secure: config.TEST_MAIL_SECURE,
            auth: {
                user: config.TEST_MAIL_AUTH_USER,
                pass: config.TEST_MAIL_AUTH_PASS,
            },

        })

    })
    describe("reset password request SUCCESS", () => {
        test("sucess test case", async () => {
            const InputData: UserRequestModel = {
                email: "john@gmail.com"
            }

            const goten_user_1: UserResponseModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                confirmation_code: "confirmation_code",
                reset_password_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }
            const goten_user_2: UserResponseModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                confirmation_code: "confirmation_code",
                reset_password_code: "reset_password_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }
            const generated_token = "token"

            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(goten_user_1)).mockImplementationOnce(() => Promise.resolve(goten_user_2))
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
            jest.spyOn(mockUserRepository, "setResetPasswordCode").mockImplementation(() => Promise.resolve(1))
            jest.spyOn(mockUserRepository, "generateResetPasswordToken").mockImplementation(() => { return generated_token })
            jest.spyOn(mockMailerAdapter, "send_reset_password_email").mockImplementation(() => Promise.resolve())


            const reset_password_request = new ResetPasswordRequest(mockUserRepository, mockTransporter, mockMailerAdapter)
            await reset_password_request.execute(InputData);

            expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { email: "john@gmail.com" });
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledWith(goten_user_1.user_id);
            expect(mockUserRepository.setResetPasswordCode).toHaveBeenCalledWith({ user_id: 1 });
            expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(2, { user_id: 1 });
            expect(mockUserRepository.generateResetPasswordToken).toHaveBeenCalledWith(goten_user_2);
            expect(mockMailerAdapter.send_reset_password_email).toHaveBeenCalledWith(mockTransporter, goten_user_2, generated_token);
        });

    })
    describe("reset password request ERRORS", () => {
        test("User does not exist", async () => {
            const InputData: UserRequestModel = {
                email: "john@gmail.com"
            }

            const generated_token = "token"

            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(null)).mockImplementationOnce(() => Promise.resolve(null))
            jest.spyOn(mockUserRepository, "setResetPasswordCode").mockImplementation(() => Promise.resolve(0))
            jest.spyOn(mockUserRepository, "generateResetPasswordToken").mockImplementation(() => { return generated_token })
            jest.spyOn(mockMailerAdapter, "send_reset_password_email").mockImplementation(() => Promise.resolve())


            const reset_password_request = new ResetPasswordRequest(mockUserRepository, mockTransporter, mockMailerAdapter)
            try { await reset_password_request.execute(InputData); }
            catch (err) {
                expect(err.message).toBe("User does not exist")
            }

            expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { email: "john@gmail.com" });
            expect(mockUserRepository.setResetPasswordCode).not.toHaveBeenCalled();
            expect(mockUserRepository.getUser).toHaveBeenCalledTimes(1);
            expect(mockUserRepository.generateResetPasswordToken).not.toHaveBeenCalled();
            expect(mockMailerAdapter.send_reset_password_email).not.toHaveBeenCalled();
        });
        test("User is deleted", async () => {
            const InputData: UserRequestModel = {
                email: "john@gmail.com"
            }

            const goten_user_1: UserResponseModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                reset_password_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }

            const generated_token = "token"

            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(goten_user_1)).mockImplementationOnce(() => Promise.resolve(null))
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(new Error("User cannot be used")))
            jest.spyOn(mockUserRepository, "setResetPasswordCode").mockImplementation(() => Promise.resolve(0))
            jest.spyOn(mockUserRepository, "generateResetPasswordToken").mockImplementation(() => { return generated_token })
            jest.spyOn(mockMailerAdapter, "send_reset_password_email").mockImplementation(() => Promise.resolve())


            const reset_password_request = new ResetPasswordRequest(mockUserRepository, mockTransporter, mockMailerAdapter)
            try { await reset_password_request.execute(InputData); }
            catch (err) {
                expect(err.message).toBe("User cannot be used")
            }

            expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { email: "john@gmail.com" });
            expect(mockUserRepository.setResetPasswordCode).not.toHaveBeenCalled();
            expect(mockUserRepository.getUser).toHaveBeenCalledTimes(1);
            expect(mockUserRepository.generateResetPasswordToken).not.toHaveBeenCalled();
            expect(mockMailerAdapter.send_reset_password_email).not.toHaveBeenCalled();
        });
        test("User email is not validated", async () => {
            const InputData: UserRequestModel = {
                email: "john@gmail.com"
            }

            const goten_user_1: UserResponseModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                reset_password_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }

            const generated_token = "token"

            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(goten_user_1)).mockImplementationOnce(() => Promise.resolve(null))
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(new Error("User cannot be used")))
            jest.spyOn(mockUserRepository, "setResetPasswordCode").mockImplementation(() => Promise.resolve(0))
            jest.spyOn(mockUserRepository, "generateResetPasswordToken").mockImplementation(() => { return generated_token })
            jest.spyOn(mockMailerAdapter, "send_reset_password_email").mockImplementation(() => Promise.resolve())


            const reset_password_request = new ResetPasswordRequest(mockUserRepository, mockTransporter, mockMailerAdapter)
            try { await reset_password_request.execute(InputData); }
            catch (err) {
                expect(err.message).toBe("User cannot be used")
            }

            expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { email: "john@gmail.com" });
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledWith(goten_user_1.user_id);
            expect(mockUserRepository.setResetPasswordCode).not.toHaveBeenCalled();
            expect(mockUserRepository.getUser).toHaveBeenCalledTimes(1);
            expect(mockUserRepository.generateResetPasswordToken).not.toHaveBeenCalled();
            expect(mockMailerAdapter.send_reset_password_email).not.toHaveBeenCalled();
        });
        test("Cannot set password reset code", async () => {
            const InputData: UserRequestModel = {
                email: "john@gmail.com"
            }

            const goten_user_1: UserResponseModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                confirmation_code: "confirmation_code",
                reset_password_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }

            const generated_token = "token"

            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(goten_user_1)).mockImplementationOnce(() => Promise.resolve(null))
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
            jest.spyOn(mockUserRepository, "setResetPasswordCode").mockImplementation(() => Promise.resolve(0))
            jest.spyOn(mockUserRepository, "generateResetPasswordToken").mockImplementation(() => { return generated_token })
            jest.spyOn(mockMailerAdapter, "send_reset_password_email").mockImplementation(() => Promise.resolve())


            const reset_password_request = new ResetPasswordRequest(mockUserRepository, mockTransporter, mockMailerAdapter)
            try { await reset_password_request.execute(InputData); }
            catch (err) {
                expect(err.message).toBe("Cannot set password reset code")
            }

            expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { email: "john@gmail.com" });
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledWith(goten_user_1.user_id);
            expect(mockUserRepository.setResetPasswordCode).toHaveBeenCalledWith({ user_id: 1 });
            expect(mockUserRepository.getUser).toHaveBeenCalledTimes(1);
            expect(mockUserRepository.generateResetPasswordToken).not.toHaveBeenCalled();
            expect(mockMailerAdapter.send_reset_password_email).not.toHaveBeenCalled();
        });
        test("Cannot find updated user", async () => {
            const InputData: UserRequestModel = {
                email: "john@gmail.com"
            }

            const goten_user_1: UserResponseModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                confirmation_code: "confirmation_code",
                reset_password_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }

            const generated_token = "token"

            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(goten_user_1)).mockImplementationOnce(() => Promise.resolve(null))
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
            jest.spyOn(mockUserRepository, "setResetPasswordCode").mockImplementation(() => Promise.resolve(1))
            jest.spyOn(mockUserRepository, "generateResetPasswordToken").mockImplementation(() => { return generated_token })
            jest.spyOn(mockMailerAdapter, "send_reset_password_email").mockImplementation(() => Promise.resolve())


            const reset_password_request = new ResetPasswordRequest(mockUserRepository, mockTransporter, mockMailerAdapter)
            try { await reset_password_request.execute(InputData); }
            catch (err) {
                expect(err.message).toBe("Cannot find updated user")
            }

            expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { email: "john@gmail.com" });
            expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledWith(goten_user_1.user_id);
            expect(mockUserRepository.setResetPasswordCode).toHaveBeenCalledWith({ user_id: 1 });
            expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(2, { user_id: 1 });
            expect(mockUserRepository.generateResetPasswordToken).not.toHaveBeenCalled();
            expect(mockMailerAdapter.send_reset_password_email).not.toHaveBeenCalled();
        });
    })

})