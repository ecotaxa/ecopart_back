import { Transporter } from "nodemailer";
import { DecodedToken } from "../../../../src/domain/entities/auth";
import { UserRequesCreationtModel, UserResponseModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { CreateUser } from '../../../../src/domain/use-cases/user/create-user'
import { NodemailerAdapter } from '../../../../src/infra/mailer/nodemailer'
import { MailerWrapper } from "../../../../src/infra/mailer/nodemailer-wrapper";

describe("Create User Use Case", () => {
    class MockUserRepository implements UserRepository {
        adminUpdateUser(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        standardUpdateUser(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        isAdmin(): Promise<boolean> {
            throw new Error("Method not implemented.");
        }
        createUser(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        getUsers(): Promise<UserResponseModel[]> {
            throw new Error("Method not implemented.");
        }
        getUser(): Promise<UserResponseModel | null> {
            throw new Error("Method not implemented.");
        }
        verifyUserLogin(): Promise<boolean> {
            throw new Error("Method not implemented.");
        }
        validUser(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        generateValidationToken(): string {
            throw new Error("Method not implemented.");
        }
        verifyValidationToken(): DecodedToken | null {
            throw new Error("Method not implemented.");
        }
    }

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
        TEST_PORT: 3000,
        TEST_BASE_URL: "http://localhost:"

    }
    beforeEach(async () => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository()
        mockMailerAdapter = new NodemailerAdapter((config.TEST_BASE_URL + config.TEST_PORT), config.TEST_MAIL_SENDER)
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

    test("Try to add a user return created user", async () => {
        const InputData: UserRequesCreationtModel = {
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            password: "test123!",
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        }
        const created_user: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: false,
            confirmation_code: "confirmation_code",
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }
        const OutputData: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: false,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }

        jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(null)).mockImplementationOnce(() => Promise.resolve(created_user))
        jest.spyOn(mockUserRepository, "createUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "standardUpdateUser").mockImplementation(() => Promise.resolve(-1))
        jest.spyOn(mockUserRepository, "generateValidationToken").mockImplementation(() => "token")
        jest.spyOn(mockMailerAdapter, "send_confirmation_email").mockImplementation(() => Promise.resolve())

        const createUserUseCase = new CreateUser(mockUserRepository, mockTransporter, mockMailerAdapter)
        const result = await createUserUseCase.execute(InputData);

        expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { email: "john@gmail.com" });
        expect(mockUserRepository.createUser).toHaveBeenCalledWith(InputData);
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(2, { user_id: 1 });
        expect(mockUserRepository.generateValidationToken).toHaveBeenCalledWith(created_user);
        expect(mockMailerAdapter.send_confirmation_email).toHaveBeenCalledWith(mockTransporter, OutputData, "token");

        expect(result).toStrictEqual(OutputData);
    });

    test("Try to add a user that already exist with unvalidated email", async () => {
        const InputData: UserRequesCreationtModel = {
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            password: "test123!",
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        }
        const preexistant_user: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: false,
            confirmation_code: "confirmation_code",
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }
        const updated_user: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: false,
            confirmation_code: "new_confirmation_code",
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }
        const OutputData: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: false,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }

        jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(preexistant_user)).mockImplementationOnce(() => Promise.resolve(updated_user))
        jest.spyOn(mockUserRepository, "standardUpdateUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "createUser").mockImplementation(() => Promise.resolve(-1)) // not called
        jest.spyOn(mockUserRepository, "generateValidationToken").mockImplementation(() => "token")
        jest.spyOn(mockMailerAdapter, "send_confirmation_email").mockImplementation(() => Promise.resolve())

        const createUserUseCase = new CreateUser(mockUserRepository, mockTransporter, mockMailerAdapter)
        const result = await createUserUseCase.execute(InputData);

        expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { email: "john@gmail.com" });
        expect(mockUserRepository.createUser).not.toBeCalled();
        expect(mockUserRepository.standardUpdateUser).toHaveBeenCalledWith(preexistant_user);
        expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(2, { user_id: 1 });
        expect(mockUserRepository.generateValidationToken).toHaveBeenCalledWith(updated_user);
        expect(mockMailerAdapter.send_confirmation_email).toHaveBeenCalledWith(mockTransporter, OutputData, "token");

        expect(result).toStrictEqual(OutputData);
    });

    test("Try to add a user that already exist with validated email", async () => {
        const InputData: UserRequesCreationtModel = {
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            password: "test123!",
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        }

        const preexistant_user: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: true,
            confirmation_code: undefined,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }

        const expectedResponse = new Error("Valid user already exists");

        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(preexistant_user))
        jest.spyOn(mockUserRepository, "standardUpdateUser").mockImplementation(() => Promise.resolve(1))// not called
        jest.spyOn(mockUserRepository, "createUser").mockImplementation(() => Promise.resolve(-1)) // not called
        jest.spyOn(mockUserRepository, "generateValidationToken").mockImplementation(() => "") // not called
        jest.spyOn(mockMailerAdapter, "send_confirmation_email").mockImplementation(() => Promise.resolve()) // not called

        const createUserUseCase = new CreateUser(mockUserRepository, mockTransporter, mockMailerAdapter)
        try {
            await createUserUseCase.execute(InputData);
            expect(true).toStrictEqual(false);

        } catch (err) {
            expect(mockUserRepository.getUser).toHaveBeenCalledWith({ email: "john@gmail.com" });
            expect(mockUserRepository.getUser).toHaveBeenCalledTimes(1);
            expect(mockUserRepository.createUser).not.toBeCalled();
            expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
            expect(mockUserRepository.generateValidationToken).not.toBeCalled();
            expect(mockMailerAdapter.send_confirmation_email).not.toBeCalled();

            expect(err).toStrictEqual(expectedResponse);
        }


    });

    test("Can't update preexistent user", async () => {
        const InputData: UserRequesCreationtModel = {
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            password: "test123!",
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        }
        const preexistant_user: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: false,
            confirmation_code: undefined,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }

        const expectedResponse = new Error("Can't update preexistent user");

        jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(preexistant_user)).mockImplementationOnce(() => Promise.resolve(null))
        jest.spyOn(mockUserRepository, "standardUpdateUser").mockImplementation(() => Promise.resolve(0))
        jest.spyOn(mockUserRepository, "createUser").mockImplementation(() => Promise.resolve(-1)) // not called
        jest.spyOn(mockUserRepository, "generateValidationToken").mockImplementation(() => "token") // not called
        jest.spyOn(mockMailerAdapter, "send_confirmation_email").mockImplementation(() => Promise.resolve()) // not called

        const createUserUseCase = new CreateUser(mockUserRepository, mockTransporter, mockMailerAdapter);
        try {
            await createUserUseCase.execute(InputData);
            expect(true).toBe(false)
        } catch (err) {

            expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { email: "john@gmail.com" });
            expect(mockUserRepository.createUser).not.toBeCalled();
            expect(mockUserRepository.standardUpdateUser).toHaveBeenCalledWith(preexistant_user);
            expect(mockUserRepository.generateValidationToken).not.toBeCalled();
            expect(mockMailerAdapter.send_confirmation_email).not.toBeCalled();

            expect(err).toStrictEqual(expectedResponse);
        }
    });

    test("Can't find updated preexistent user", async () => {
        const InputData: UserRequesCreationtModel = {
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            password: "test123!",
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        }
        const preexistant_user: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: false,
            confirmation_code: undefined,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }

        const expectedResponse = new Error("Can't find updated preexistent user");

        jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(preexistant_user)).mockImplementationOnce(() => Promise.resolve(null))
        jest.spyOn(mockUserRepository, "standardUpdateUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "createUser").mockImplementation(() => Promise.resolve(-1)) // not called
        jest.spyOn(mockUserRepository, "generateValidationToken").mockImplementation(() => "token") // not called
        jest.spyOn(mockMailerAdapter, "send_confirmation_email").mockImplementation(() => Promise.resolve())// not called

        const createUserUseCase = new CreateUser(mockUserRepository, mockTransporter, mockMailerAdapter);
        try {
            await createUserUseCase.execute(InputData);
            expect(true).toBe(false)
        } catch (err) {

            expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { email: "john@gmail.com" });
            expect(mockUserRepository.createUser).not.toBeCalled();
            expect(mockUserRepository.standardUpdateUser).toHaveBeenCalledWith(preexistant_user);
            expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(2, { user_id: 1 });
            expect(mockUserRepository.generateValidationToken).not.toBeCalled();
            expect(mockMailerAdapter.send_confirmation_email).not.toBeCalled();

            expect(err).toStrictEqual(expectedResponse);
        }
    });

})