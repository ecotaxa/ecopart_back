
import { DecodedToken, ResetCredentialsModel } from "../../../../src/domain/entities/auth";
import { UserResponseModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { ResetPassword } from '../../../../src/domain/use-cases/auth/reset-password'

describe("Change password Use Case", () => {
    class MockUserRepository implements UserRepository {
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

    beforeEach(async () => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository()
    })
    describe("reset password request SUCCESS", () => {
        test("sucess test case", async () => {
            const InputData: ResetCredentialsModel = {
                reset_password_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyZXNldF9wYXNzd29yZF9jb2RlIjoiNjgzMzllZmItMDEwZS00ZjE4LWJhYmQtMjEyNWNiZDA4ZmU2IiwiaWF0IjoxNzA2MTcxNjcxLCJleHAiOjE3MDYxODI0NzF9.cJsCSTVldkPULrzz-i0NxumCerZLIDibbuy3vGXiHMY",
                new_password: "new_password"
            }

            const decoded_token: DecodedToken = {
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
                user_creation_date: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }

            const preexistant_user: UserResponseModel = {
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
            const nb_of_updated_user = 1

            jest.spyOn(mockUserRepository, "verifyResetPasswordToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(preexistant_user))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(nb_of_updated_user))


            const reset_password = new ResetPassword(mockUserRepository)
            await reset_password.execute(InputData);

            expect(mockUserRepository.verifyResetPasswordToken).toHaveBeenCalledWith(InputData.reset_password_token);
            expect(mockUserRepository.isDeleted).toHaveBeenCalledWith(1);
            expect(mockUserRepository.getUser).toHaveBeenCalledWith({ user_id: 1, reset_password_code: decoded_token.reset_password_code });
            expect(mockUserRepository.changePassword).toHaveBeenCalledWith({ ...preexistant_user, ...InputData });
        });

    })
    describe("reset password request ERRORS", () => {
        test("Token is not valid", async () => {
            const InputData: ResetCredentialsModel = {
                reset_password_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyZXNldF9wYXNzd29yZF9jb2RlIjoiNjgzMzllZmItMDEwZS00ZjE4LWJhYmQtMjEyNWNiZDA4ZmU2IiwiaWF0IjoxNzA2MTcxNjcxLCJleHAiOjE3MDYxODI0NzF9.cJsCSTVldkPULrzz-i0NxumCerZLIDibbuy3vGXiHMY",
                new_password: "new_password"
            }

            const nb_of_updated_user = 0

            jest.spyOn(mockUserRepository, "verifyResetPasswordToken").mockImplementation(() => { return null })
            jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(null))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(nb_of_updated_user))


            const reset_password = new ResetPassword(mockUserRepository)
            try {
                await reset_password.execute(InputData);
            }
            catch (error) {
                expect(error.message).toBe("Token is not valid");
            }

            expect(mockUserRepository.verifyResetPasswordToken).toHaveBeenCalledWith(InputData.reset_password_token);
            expect(mockUserRepository.getUser).not.toHaveBeenCalled()
            expect(mockUserRepository.changePassword).not.toHaveBeenCalled()
        })
        test("No token provided", async () => {

            const InputData = {
                reset_password_token: "",
                new_password: "new_password"
            }

            const nb_of_updated_user = 0

            jest.spyOn(mockUserRepository, "verifyResetPasswordToken").mockImplementation(() => { return null })
            jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(null))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(nb_of_updated_user))


            const reset_password = new ResetPassword(mockUserRepository)
            try {
                await reset_password.execute(InputData);
            }
            catch (error) {
                expect(error.message).toBe("No token provided");
            }

            expect(mockUserRepository.verifyResetPasswordToken).not.toHaveBeenCalled();
            expect(mockUserRepository.getUser).not.toHaveBeenCalled();
            expect(mockUserRepository.changePassword).not.toHaveBeenCalled();
        })
        test("User does not exist or token is not valid", async () => {

            const InputData: ResetCredentialsModel = {
                reset_password_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyZXNldF9wYXNzd29yZF9jb2RlIjoiNjgzMzllZmItMDEwZS00ZjE4LWJhYmQtMjEyNWNiZDA4ZmU2IiwiaWF0IjoxNzA2MTcxNjcxLCJleHAiOjE3MDYxODI0NzF9.cJsCSTVldkPULrzz-i0NxumCerZLIDibbuy3vGXiHMY",
                new_password: "new_password"
            }

            const decoded_token: DecodedToken = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                confirmation_code: "confirmation_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const nb_of_updated_user = 0

            jest.spyOn(mockUserRepository, "verifyResetPasswordToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(null))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(nb_of_updated_user))


            const reset_password = new ResetPassword(mockUserRepository)
            try {
                await reset_password.execute(InputData);
            }
            catch (error) {
                expect(error.message).toBe("User does not exist or reset_password_code is not valid");
            }

            expect(mockUserRepository.verifyResetPasswordToken).toHaveBeenCalledWith(InputData.reset_password_token);
            expect(mockUserRepository.isDeleted).toHaveBeenCalledWith(1);
            expect(mockUserRepository.getUser).toHaveBeenCalledWith({ user_id: 1, reset_password_code: decoded_token.reset_password_code });
            expect(mockUserRepository.changePassword).not.toHaveBeenCalled()
        })
        test("User email is not validated", async () => {

            const InputData: ResetCredentialsModel = {
                reset_password_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyZXNldF9wYXNzd29yZF9jb2RlIjoiNjgzMzllZmItMDEwZS00ZjE4LWJhYmQtMjEyNWNiZDA4ZmU2IiwiaWF0IjoxNzA2MTcxNjcxLCJleHAiOjE3MDYxODI0NzF9.cJsCSTVldkPULrzz-i0NxumCerZLIDibbuy3vGXiHMY",
                new_password: "new_password"
            }

            const decoded_token: DecodedToken = {
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
                user_creation_date: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }

            const preexistant_user: UserResponseModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                reset_password_code: "reset_password_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }
            const nb_of_updated_user = 0

            jest.spyOn(mockUserRepository, "verifyResetPasswordToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(preexistant_user))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(nb_of_updated_user))


            const reset_password = new ResetPassword(mockUserRepository)
            try {
                await reset_password.execute(InputData);
            }
            catch (error) {
                expect(error.message).toBe("User email is not validated");
            }

            expect(mockUserRepository.verifyResetPasswordToken).toHaveBeenCalledWith(InputData.reset_password_token);
            expect(mockUserRepository.isDeleted).toHaveBeenCalledWith(1);
            expect(mockUserRepository.getUser).toHaveBeenCalledWith({ user_id: 1, reset_password_code: decoded_token.reset_password_code });
            expect(mockUserRepository.changePassword).not.toHaveBeenCalled()
        })
        test("Can't change password", async () => {
            const InputData: ResetCredentialsModel = {
                reset_password_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyZXNldF9wYXNzd29yZF9jb2RlIjoiNjgzMzllZmItMDEwZS00ZjE4LWJhYmQtMjEyNWNiZDA4ZmU2IiwiaWF0IjoxNzA2MTcxNjcxLCJleHAiOjE3MDYxODI0NzF9.cJsCSTVldkPULrzz-i0NxumCerZLIDibbuy3vGXiHMY",
                new_password: "new_password"
            }

            const decoded_token: DecodedToken = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                confirmation_code: "confirmation_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }

            const preexistant_user: UserResponseModel = {
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
            const nb_of_updated_user = 0

            jest.spyOn(mockUserRepository, "verifyResetPasswordToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(preexistant_user))
            jest.spyOn(mockUserRepository, "changePassword").mockImplementation(() => Promise.resolve(nb_of_updated_user))


            const reset_password = new ResetPassword(mockUserRepository)
            try {
                await reset_password.execute(InputData);
            }
            catch (error) {
                expect(error.message).toBe("Can't change password");
            }

            expect(mockUserRepository.verifyResetPasswordToken).toHaveBeenCalledWith(InputData.reset_password_token);
            expect(mockUserRepository.isDeleted).toHaveBeenCalledWith(1);
            expect(mockUserRepository.getUser).toHaveBeenCalledWith({ user_id: 1, reset_password_code: decoded_token.reset_password_code });
            expect(mockUserRepository.changePassword).toHaveBeenCalledWith({ ...preexistant_user, ...InputData });
        })
    })

})
