import { DecodedToken, ChangeCredentialsModel } from "../../../../src/domain/entities/auth";
import { SearchResult } from "../../../../src/domain/entities/search";
import { UserResponseModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { ChangePassword } from '../../../../src/domain/use-cases/auth/change-password';

/* TESTED HERE */
// User is not admin : edit password on himself : ok
// user is not admin : edit someone else password : nok
// user is not admin : edit password on himself but current and new are the same : nok
// user is not admin : edit password on himself but current password is wrong : nok

// user is admin :  edit password on himself : ok
// user is admin :  edit someone else password : ok
// user is admin :  edit password on himself but current and new are the same : ok


describe("Change password Use Case", () => {
    class MockUserRepository implements UserRepository {
        adminGetUsers(): Promise<SearchResult> {
            throw new Error("Method not implemented.");
        }
        standardGetUsers(): Promise<SearchResult> {
            throw new Error("Method not implemented.");
        }
        deleteUser(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        isDeleted(): Promise<boolean> {
            throw new Error("Method not implemented.");
        }
        generateResetPasswordToken(): string {
            throw new Error("Method not implemented.");
        }
        verifyResetPasswordToken(): DecodedToken | null {
            throw new Error("Method not implemented.");
        }
        setResetPasswordCode(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        toPublicUser(): UserResponseModel {
            throw new Error("Method not implemented.");
        }
        changePassword(): Promise<number> {
            throw new Error("Method not implemented.");
        }
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

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository()
    })

    describe("Not admin user", () => {

        test("User is not admin : and try to change password of deleted user", async () => {
            const current_user: DecodedToken = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: true,
                confirmation_code: null,
                is_admin: false,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const credentials: ChangeCredentialsModel = {
                user_id: 2,
                password: "good_current_password",
                new_password: "new_password"
            }
            const expectedResponse = new Error("User is deleted");


            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementationOnce(() => Promise.resolve(true)).mockImplementationOnce(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(0))

            const changePasswordUseCase = new ChangePassword(mockUserRepository)
            try {
                await changePasswordUseCase.execute(current_user, credentials);
                expect(true).toBe(false)
            } catch (err) {
                expect(err).toStrictEqual(expectedResponse);
                expect(mockUserRepository.isAdmin).not.toBeCalled();
                expect(mockUserRepository.isDeleted).toBeCalledTimes(1);
                expect(mockUserRepository.verifyUserLogin).not.toBeCalled();
                expect(mockUserRepository.changePassword).not.toBeCalled();
            }

        });
        test("User is not admin : and is deleted", async () => {
            const current_user: DecodedToken = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: true,
                confirmation_code: null,
                is_admin: false,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const credentials: ChangeCredentialsModel = {
                user_id: 2,
                password: "good_current_password",
                new_password: "new_password"
            }
            const expectedResponse = new Error("User is deleted");


            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementationOnce(() => Promise.resolve(false)).mockImplementationOnce(() => Promise.resolve(true))
            jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(0))

            const changePasswordUseCase = new ChangePassword(mockUserRepository)
            try {
                await changePasswordUseCase.execute(current_user, credentials);
                expect(true).toBe(false)
            } catch (err) {
                expect(err).toStrictEqual(expectedResponse);
                expect(mockUserRepository.isAdmin).not.toBeCalled();
                expect(mockUserRepository.isDeleted).toBeCalledTimes(2);
                expect(mockUserRepository.verifyUserLogin).not.toBeCalled();
                expect(mockUserRepository.changePassword).not.toBeCalled();
            }

        });

        test("User is not admin : edit password on himself : ok", async () => {
            const current_user: DecodedToken = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: true,
                confirmation_code: null,
                is_admin: false,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const credentials: ChangeCredentialsModel = {
                user_id: 1,
                password: "good_current_password",
                new_password: "new_password"
            }

            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(true))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(1))

            const changePasswordUseCase = new ChangePassword(mockUserRepository)
            try {
                await changePasswordUseCase.execute(current_user, credentials);
                expect(mockUserRepository.isAdmin).toBeCalledWith(1);
                expect(mockUserRepository.isDeleted).toBeCalledWith(1);
                expect(mockUserRepository.verifyUserLogin).toBeCalledWith({ email: current_user.email, password: credentials.password });
                expect(mockUserRepository.changePassword).toBeCalledWith(credentials);
            } catch (err) {
                expect(true).toBe(false)
            }

        });

        test("User is not admin : edit someone else password : nok", async () => {
            const current_user: DecodedToken = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: true,
                confirmation_code: null,
                is_admin: false,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const credentials: ChangeCredentialsModel = {
                user_id: 2,
                password: "good_current_password",
                new_password: "new_password"
            }
            const expectedResponse = new Error("Logged user cannot update this property or user");


            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(0))

            const changePasswordUseCase = new ChangePassword(mockUserRepository)
            try {
                await changePasswordUseCase.execute(current_user, credentials);
                expect(true).toBe(false)
            } catch (err) {
                expect(err).toStrictEqual(expectedResponse);
                expect(mockUserRepository.isAdmin).toBeCalledWith(1);
                expect(mockUserRepository.isDeleted).toBeCalledWith(2);
                expect(mockUserRepository.verifyUserLogin).not.toBeCalled();
                expect(mockUserRepository.changePassword).not.toBeCalled();
            }

        });

        test("User is not admin : edit password on himself but current and new are the same : nok", async () => {
            const current_user: DecodedToken = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: true,
                confirmation_code: null,
                is_admin: false,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const credentials: ChangeCredentialsModel = {
                user_id: 1,
                password: "password",
                new_password: "password"
            }
            const expectedResponse = new Error("New password must be different from old password");


            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(0))

            const changePasswordUseCase = new ChangePassword(mockUserRepository)
            try {
                await changePasswordUseCase.execute(current_user, credentials);
                expect(true).toBe(false)
            } catch (err) {
                expect(err).toStrictEqual(expectedResponse);
                expect(mockUserRepository.isAdmin).toBeCalledWith(1);
                expect(mockUserRepository.isDeleted).toBeCalledWith(1);
                expect(mockUserRepository.verifyUserLogin).not.toBeCalled();
                expect(mockUserRepository.changePassword).not.toBeCalled();
            }

        });

        test("User is not admin : edit password on himself but current password is wrong : nok", async () => {
            const current_user: DecodedToken = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: true,
                confirmation_code: null,
                is_admin: false,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const credentials: ChangeCredentialsModel = {
                user_id: 1,
                password: "bad_current_password",
                new_password: "new_password"
            }
            const expectedResponse = new Error("Invalid credentials");


            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(0))

            const changePasswordUseCase = new ChangePassword(mockUserRepository)
            try {
                await changePasswordUseCase.execute(current_user, credentials);
                expect(true).toBe(false)
            } catch (err) {
                expect(err).toStrictEqual(expectedResponse);
                expect(mockUserRepository.isAdmin).toBeCalledWith(1);
                expect(mockUserRepository.isDeleted).toBeCalledWith(1);
                expect(mockUserRepository.verifyUserLogin).toBeCalledWith({ email: current_user.email, password: credentials.password });
                expect(mockUserRepository.changePassword).not.toBeCalled();
            }

        });

        test("User is not admin : internal error unable to change password", async () => {
            const current_user: DecodedToken = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: true,
                confirmation_code: null,
                is_admin: false,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const credentials: ChangeCredentialsModel = {
                user_id: 1,
                password: "current_password",
                new_password: "new_password"
            }
            const expectedResponse = new Error("Can't change password");

            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(true))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(0))

            const changePasswordUseCase = new ChangePassword(mockUserRepository)
            try {
                await changePasswordUseCase.execute(current_user, credentials);
                expect(true).toBe(false)
            } catch (err) {
                expect(err).toStrictEqual(expectedResponse);
                expect(mockUserRepository.isAdmin).toBeCalledWith(1);
                expect(mockUserRepository.isDeleted).toBeCalledWith(1);
                expect(mockUserRepository.verifyUserLogin).toBeCalledWith({ email: current_user.email, password: credentials.password });
                expect(mockUserRepository.changePassword).toBeCalledWith(credentials);
            }
        });
    })

    describe("Admin user", () => {
        test("User is admin : edit password on himself : ok", async () => {
            const current_user: DecodedToken = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: true,
                confirmation_code: null,
                is_admin: true,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const credentials: ChangeCredentialsModel = {
                user_id: 1,
                password: "good_current_password",
                new_password: "new_password"
            }

            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(1))

            const changePasswordUseCase = new ChangePassword(mockUserRepository)
            try {
                await changePasswordUseCase.execute(current_user, credentials);
                expect(mockUserRepository.isAdmin).toBeCalledWith(1);
                expect(mockUserRepository.isDeleted).toBeCalledWith(1);
                expect(mockUserRepository.verifyUserLogin).not.toBeCalled();
                expect(mockUserRepository.changePassword).toBeCalledWith(credentials);
            } catch (err) {
                expect(true).toBe(false)
            }

        });

        test("User is admin : edit someone else password : ok", async () => {
            const current_user: DecodedToken = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: true,
                confirmation_code: null,
                is_admin: true,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const credentials: ChangeCredentialsModel = {
                user_id: 2,
                password: "good_current_password",
                new_password: "new_password"
            }

            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(1))

            const changePasswordUseCase = new ChangePassword(mockUserRepository)
            try {
                await changePasswordUseCase.execute(current_user, credentials);
                expect(mockUserRepository.isAdmin).toBeCalledWith(1);
                expect(mockUserRepository.isDeleted).toBeCalledWith(2);
                expect(mockUserRepository.verifyUserLogin).not.toBeCalled();
                expect(mockUserRepository.changePassword).toBeCalledWith(credentials);
            } catch (err) {
                expect(true).toBe(false)
            }

        });

        test("User is admin : edit password on himself but current and new are the same : ok", async () => {
            const current_user: DecodedToken = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: true,
                confirmation_code: null,
                is_admin: true,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const credentials: ChangeCredentialsModel = {
                user_id: 1,
                password: "password",
                new_password: "password"
            }

            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(1))

            const changePasswordUseCase = new ChangePassword(mockUserRepository)
            try {
                await changePasswordUseCase.execute(current_user, credentials);
                expect(mockUserRepository.isAdmin).toBeCalledWith(1);
                expect(mockUserRepository.isDeleted).toBeCalledWith(1);
                expect(mockUserRepository.verifyUserLogin).not.toBeCalled();
                expect(mockUserRepository.changePassword).toBeCalledWith(credentials);
            } catch (err) {
                expect(true).toBe(false)
            }
        });

        test("User is admin : internal error unable to change password", async () => {
            const current_user: DecodedToken = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: true,
                confirmation_code: null,
                is_admin: true,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const credentials: ChangeCredentialsModel = {
                user_id: 1,
                password: "password",
                new_password: "password"
            }
            const expectedResponse = new Error("Can't change password");

            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(0))

            const changePasswordUseCase = new ChangePassword(mockUserRepository)
            try {
                await changePasswordUseCase.execute(current_user, credentials);
                expect(true).toBe(false)
            } catch (err) {
                expect(err).toStrictEqual(expectedResponse);
                expect(mockUserRepository.isAdmin).toBeCalledWith(1);
                expect(mockUserRepository.isDeleted).toBeCalledWith(1);
                expect(mockUserRepository.verifyUserLogin).not.toBeCalled();
                expect(mockUserRepository.changePassword).toBeCalledWith(credentials);
            }
        });
    })
})