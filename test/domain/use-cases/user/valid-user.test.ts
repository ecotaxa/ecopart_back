import { DecodedToken } from "../../../../src/domain/entities/auth";
import { SearchResult } from "../../../../src/domain/entities/search";
import { UserResponseModel, } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { ValidUser } from '../../../../src/domain/use-cases/user/valid-user'

describe("Valid Users Use Case", () => {

    class MockUserRepository implements UserRepository {
        adminGetUsers(): Promise<SearchResult<UserResponseModel>> {
            throw new Error("Method not implemented.");
        }
        standardGetUsers(): Promise<SearchResult<UserResponseModel>> {
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
    describe("Nominal case", () => {
        test("User is validated", async () => {

            const user_id = 1
            const confirmation_token = "token"

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
            const user_to_update: UserResponseModel = {
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
                valid_email: true,
                confirmation_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }


            jest.spyOn(mockUserRepository, "verifyValidationToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(user_to_update)).mockImplementationOnce(() => Promise.resolve(updated_user))
            jest.spyOn(mockUserRepository, "validUser").mockImplementation(() => Promise.resolve(1))

            const getAllUsersUse = new ValidUser(mockUserRepository)

            try {
                await getAllUsersUse.execute(user_id, confirmation_token);
            } catch (e) {
                console.log(e.message)
                expect(true).toBe(false)
            }
            expect(mockUserRepository.verifyValidationToken).toHaveBeenCalledWith(confirmation_token);
            expect(mockUserRepository.isDeleted).toBeCalledTimes(1);
            expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { user_id: user_id, confirmation_code: decoded_token.confirmation_code });
            expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(2, { user_id: user_to_update.user_id });
            expect(mockUserRepository.validUser).toHaveBeenCalledWith(user_to_update);
        });
    })

    describe("Error cases", () => {
        test("Invalid confirmation token", async () => {

            const user_id = 1
            const confirmation_token = "token"

            const decoded_token = null
            const user_to_update: UserResponseModel = {
                user_id: user_id,
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
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                confirmation_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }


            jest.spyOn(mockUserRepository, "verifyValidationToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(user_to_update)).mockImplementationOnce(() => Promise.resolve(updated_user))
            jest.spyOn(mockUserRepository, "validUser").mockImplementation(() => Promise.resolve(1))

            const getAllUsersUse = new ValidUser(mockUserRepository)

            try {
                await getAllUsersUse.execute(user_id, confirmation_token);
                expect(true).toBe(false)
            } catch (e) {
                expect(mockUserRepository.verifyValidationToken).toHaveBeenCalledWith(confirmation_token);
                expect(mockUserRepository.getUser).not.toBeCalled();
                expect(mockUserRepository.validUser).not.toBeCalled();
                expect(e.message).toBe("Invalid confirmation token")
            }
        });

        test("Cross user vallidation forbidden", async () => {

            const user_id = 1
            const confirmation_token = "token"

            const decoded_token: DecodedToken = {
                user_id: 2,
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
            const user_to_update: UserResponseModel = {
                user_id: user_id,
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
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                confirmation_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }


            jest.spyOn(mockUserRepository, "verifyValidationToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(user_to_update)).mockImplementationOnce(() => Promise.resolve(updated_user))
            jest.spyOn(mockUserRepository, "validUser").mockImplementation(() => Promise.resolve(1))

            const getAllUsersUse = new ValidUser(mockUserRepository)

            try {
                await getAllUsersUse.execute(user_id, confirmation_token);
                expect(true).toBe(false)
            } catch (e) {
                expect(mockUserRepository.verifyValidationToken).toHaveBeenCalledWith(confirmation_token);
                expect(mockUserRepository.getUser).not.toBeCalled();
                expect(mockUserRepository.validUser).not.toBeCalled();
                expect(e.message).toBe("User vallidation forbidden")
            }
        });
        test("User is deleted", async () => {
            const user_id = 1
            const confirmation_token = "token"

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
            const user_to_update: UserResponseModel = {
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
                valid_email: true,
                confirmation_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }


            jest.spyOn(mockUserRepository, "verifyValidationToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(true))
            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(user_to_update)).mockImplementationOnce(() => Promise.resolve(updated_user))
            jest.spyOn(mockUserRepository, "validUser").mockImplementation(() => Promise.resolve(1))

            const getAllUsersUse = new ValidUser(mockUserRepository)
            try {
                await getAllUsersUse.execute(user_id, confirmation_token);
                expect(true).toBe(false)
            } catch (e) {
                expect(e.message).toBe("User is deleted")
                expect(mockUserRepository.verifyValidationToken).toHaveBeenCalledWith(confirmation_token);
                expect(mockUserRepository.isDeleted).toBeCalledTimes(1);
                expect(mockUserRepository.getUser).not.toBeCalled();
                expect(mockUserRepository.validUser).not.toBeCalled();
            }

        });

        test("Can't find user with confirmation code", async () => {

            const user_id = 1
            const confirmation_token = "token"

            const decoded_token: DecodedToken = {
                user_id: user_id,
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
            const user_to_update = null
            const updated_user: UserResponseModel = {
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                confirmation_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }


            jest.spyOn(mockUserRepository, "verifyValidationToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(user_to_update)).mockImplementationOnce(() => Promise.resolve(updated_user))
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "validUser").mockImplementation(() => Promise.resolve(1))

            const getAllUsersUse = new ValidUser(mockUserRepository)

            try {
                await getAllUsersUse.execute(user_id, confirmation_token);
                expect(true).toBe(false)
            } catch (e) {
                expect(mockUserRepository.verifyValidationToken).toHaveBeenCalledWith(confirmation_token);
                expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { user_id: user_id, confirmation_code: decoded_token.confirmation_code });
                expect(mockUserRepository.getUser).toHaveBeenCalledTimes(1);
                expect(mockUserRepository.isDeleted).toBeCalledTimes(1);
                expect(mockUserRepository.validUser).not.toBeCalled();
                expect(e.message).toBe("Can't find user with confirmation code")
            }
        });

        test("Can't find user with confirmation code", async () => {

            const user_id = 1
            const confirmation_token = "token"

            const decoded_token: DecodedToken = {
                user_id: user_id,
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
            const user_to_update: UserResponseModel = {
                user_id: user_id,
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
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                confirmation_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }


            jest.spyOn(mockUserRepository, "verifyValidationToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(user_to_update)).mockImplementationOnce(() => Promise.resolve(updated_user))
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "validUser").mockImplementation(() => Promise.resolve(0))

            const getAllUsersUse = new ValidUser(mockUserRepository)

            try {
                await getAllUsersUse.execute(user_id, confirmation_token);
                expect(true).toBe(false)
            } catch (e) {
                expect(mockUserRepository.verifyValidationToken).toHaveBeenCalledWith(confirmation_token);
                expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { user_id: user_id, confirmation_code: decoded_token.confirmation_code });
                expect(mockUserRepository.getUser).toHaveBeenCalledTimes(1);
                expect(mockUserRepository.isDeleted).toBeCalledTimes(1);
                expect(mockUserRepository.validUser).toHaveBeenCalledWith(user_to_update);

                expect(e.message).toBe("Can't update user")
            }
        });

        test("Can't find updated user", async () => {

            const user_id = 1
            const confirmation_token = "token"

            const decoded_token: DecodedToken = {
                user_id: user_id,
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
            const user_to_update: UserResponseModel = {
                user_id: user_id,
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
            const updated_user = null

            jest.spyOn(mockUserRepository, "verifyValidationToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(user_to_update)).mockImplementationOnce(() => Promise.resolve(updated_user))
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "validUser").mockImplementation(() => Promise.resolve(1))

            const getAllUsersUse = new ValidUser(mockUserRepository)

            try {
                await getAllUsersUse.execute(user_id, confirmation_token);
                expect(true).toBe(false)
            } catch (e) {
                expect(mockUserRepository.verifyValidationToken).toHaveBeenCalledWith(confirmation_token);
                expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { user_id: user_id, confirmation_code: decoded_token.confirmation_code });
                expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(2, { user_id: user_id });
                expect(mockUserRepository.isDeleted).toBeCalledTimes(1);
                expect(mockUserRepository.validUser).toHaveBeenCalledWith(user_to_update);

                expect(e.message).toBe("Can't find updated user")
            }
        });
        test("Can't validate user", async () => {

            const user_id = 1
            const confirmation_token = "token"

            const decoded_token: DecodedToken = {
                user_id: user_id,
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
            const user_to_update: UserResponseModel = {
                user_id: user_id,
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
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }

            jest.spyOn(mockUserRepository, "verifyValidationToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(user_to_update)).mockImplementationOnce(() => Promise.resolve(updated_user))
            jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockUserRepository, "validUser").mockImplementation(() => Promise.resolve(1))

            const getAllUsersUse = new ValidUser(mockUserRepository)

            try {
                await getAllUsersUse.execute(user_id, confirmation_token);
                expect(true).toBe(false)
            } catch (e) {
                expect(mockUserRepository.verifyValidationToken).toHaveBeenCalledWith(confirmation_token);
                expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { user_id: user_id, confirmation_code: decoded_token.confirmation_code });
                expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(2, { user_id: user_id });
                expect(mockUserRepository.isDeleted).toBeCalledTimes(1);
                expect(mockUserRepository.validUser).toHaveBeenCalledWith(user_to_update);

                expect(e.message).toBe("Can't validate user")
            }
        });
    })


})