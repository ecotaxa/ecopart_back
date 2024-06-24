//test/domain/repositories/user-repository.test.ts
import { UserDataSource } from "../../../src/data/interfaces/data-sources/user-data-source";
import { AuthUserCredentialsModel, ChangeCredentialsModel, DecodedToken } from "../../../src/domain/entities/auth";
import { PrivateUserModel, PublicUserModel, UserRequestCreationModel, UserRequestModel, UserResponseModel, UserUpdateModel } from "../../../src/domain/entities/user";
import { SearchResult } from "../../../src/domain/entities/search";
import { UserRepository } from "../../../src/domain/interfaces/repositories/user-repository";
import { UserRepositoryImpl } from "../../../src/domain/repositories/user-repository";
import { BcryptAdapter } from "../../../src/infra/cryptography/bcript"
import { JwtAdapter } from "../../../src/infra/auth/jsonwebtoken"
import 'dotenv/config'
import { JwtPayload } from "jsonwebtoken";
import { decodedToken } from "../../entities/auth";

class MockUserDataSource implements UserDataSource {
    deleteOne(): void {
        throw new Error("Method not implemented.");
    }
    updateOne(): Promise<number> {
        throw new Error("Method not implemented.");
    }
    create(): Promise<number> {
        throw new Error("Method not implemented.");
    }
    getAll(): Promise<SearchResult<UserResponseModel>> {
        throw new Error("Method not implemented.");
    }
    getOne(): Promise<UserResponseModel> {
        throw new Error("Method not implemented.");
    }
    getUserLogin(): Promise<AuthUserCredentialsModel | null> {
        throw new Error("Method not implemented.");
    }

}
class MockBcryptAdapter extends BcryptAdapter {
    async hash(): Promise<string> {
        throw new Error("Method not implemented.");
    }
    // compare password
    async compare(): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
}
class MockJwtAdapter extends JwtAdapter {
    sign(): string {
        throw new Error("Method not implemented.");
    }
    verify(): JwtPayload | string {
        throw new Error("Method not implemented.");
    }
}

const TEST_VALIDATION_TOKEN_SECRET = process.env.TEST_VALIDATION_TOKEN_SECRET || ''
const TEST_RESET_PASSWORD_TOKEN_SECRET = process.env.TEST_RESET_PASSWORD_TOKEN_SECRET || ''

describe("User Repository", () => {
    let mockUserDataSource: UserDataSource;
    let mockBcryptAdapter: BcryptAdapter;
    let jwtAdapter: JwtAdapter;
    let userRepository: UserRepository

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserDataSource = new MockUserDataSource()
        mockBcryptAdapter = new MockBcryptAdapter()
        jwtAdapter = new MockJwtAdapter()
        userRepository = new UserRepositoryImpl(mockUserDataSource, mockBcryptAdapter, jwtAdapter, TEST_VALIDATION_TOKEN_SECRET, TEST_RESET_PASSWORD_TOKEN_SECRET)
    })

    // TODO split between admin and standard user
    describe("GetAllUsers", () => {

        test("Should return data for admin users", async () => {
            const expectedData: SearchResult<UserResponseModel> = {
                items: [{
                    user_id: 1,
                    last_name: "Smith",
                    first_name: "John",
                    email: "john@gmail.com",
                    valid_email: true,
                    is_admin: true,
                    organisation: "LOV",
                    country: "France",
                    user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                    user_creation_date: '2023-08-01 10:30:00'
                }],
                total: 1
            }
            const options = { page: 1, limit: 10, sort_by: [], filter: [] }

            jest.spyOn(mockUserDataSource, "getAll").mockImplementation(() => Promise.resolve(expectedData))
            const result = await userRepository.adminGetUsers(options);
            // exceptget all have been called with
            expect(mockUserDataSource.getAll).toHaveBeenCalledWith(options)
            expect(result).toBe(expectedData)
        });

        test("Should not return data with bad options even for admin users", async () => {
            const expectedData: SearchResult<UserResponseModel> = {
                items: [{
                    user_id: 1,
                    last_name: "Smith",
                    first_name: "John",
                    email: "john@gmail.com",
                    valid_email: true,
                    is_admin: true,
                    organisation: "LOV",
                    country: "France",
                    user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                    user_creation_date: '2023-08-01 10:30:00'
                }],
                total: 1
            }
            const options = {
                page: 1,
                limit: 10,
                sort_by: [{ sort_by: "field1", order_by: "asyc" }],
                filter: [{ field: "pasword_hash", operator: "SELECT", value: "%" }]
            }

            jest.spyOn(mockUserDataSource, "getAll").mockImplementation(() => Promise.resolve(expectedData))
            try {
                await userRepository.adminGetUsers(options);
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : Unauthorized sort_by: field1, Unauthorized order_by: asyc, Filter field: pasword_hash, Filter operator: SELECT")
            }
            // exceptget all have been called with
            expect(mockUserDataSource.getAll).not.toBeCalled()
        });
        test("Should return cleaned data for standard users", async () => {
            const expectedData: SearchResult<UserResponseModel> = {
                items: [{
                    user_id: 1,
                    last_name: "Smith",
                    first_name: "John",
                    email: "john@gmail.com",
                    valid_email: true,
                    is_admin: false,
                    organisation: "LOV",
                    country: "France",
                    user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                    user_creation_date: '2023-08-01 10:30:00'
                }],
                total: 1
            }
            const options = { page: 1, limit: 10, sort_by: [], filter: [] }
            const options_used = { page: 1, limit: 10, sort_by: [], filter: [{ field: "valid_email", operator: "=", value: true }, { field: "deleted", operator: "=", value: null }] }

            jest.spyOn(mockUserDataSource, "getAll").mockImplementation(() => Promise.resolve(expectedData))
            const result = await userRepository.standardGetUsers(options);
            // exceptget all have been called with
            expect(mockUserDataSource.getAll).toHaveBeenCalledWith(options_used)
            expect(result).toBe(expectedData)
        });

        test("Should not return data with bad options for standard users", async () => {
            const expectedData: SearchResult<UserResponseModel> = {
                items: [{
                    user_id: 1,
                    last_name: "Smith",
                    first_name: "John",
                    email: "john@gmail.com",
                    valid_email: true,
                    is_admin: true,
                    organisation: "LOV",
                    country: "France",
                    user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                    user_creation_date: '2023-08-01 10:30:00'
                }],
                total: 1
            }
            const options = {
                page: 1,
                limit: 10,
                sort_by: [{ sort_by: "field1", order_by: "asyc" }],
                filter: [{ field: "pasword_hash", operator: "SELECT", value: "%" }]
            }

            jest.spyOn(mockUserDataSource, "getAll").mockImplementation(() => Promise.resolve(expectedData))
            try {
                await userRepository.standardGetUsers(options);
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : Unauthorized sort_by: field1, Unauthorized order_by: asyc, Filter field: pasword_hash, Filter operator: SELECT")
            }
            // exceptget all have been called with
            expect(mockUserDataSource.getAll).not.toBeCalled()
        });
        test("Should not return data with bad options for standard users", async () => {
            const expectedData: SearchResult<UserResponseModel> = {
                items: [{
                    user_id: 1,
                    last_name: "Smith",
                    first_name: "John",
                    email: "john@gmail.com",
                    valid_email: true,
                    is_admin: true,
                    organisation: "LOV",
                    country: "France",
                    user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                    user_creation_date: '2023-08-01 10:30:00'
                }],
                total: 1
            }
            const options = {
                page: 1,
                limit: 10,
                sort_by: [],
                filter: [{ field: "valid_email", operator: "=", value: "true" }]
            }

            jest.spyOn(mockUserDataSource, "getAll").mockImplementation(() => Promise.resolve(expectedData))
            try {
                await userRepository.standardGetUsers(options);
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : filter field : valid_email")
            }
            // exceptget all have been called with
            expect(mockUserDataSource.getAll).not.toBeCalled()
        });
        test("Should not return data with bad options for standard users", async () => {
            const expectedData: SearchResult<UserResponseModel> = {
                items: [{
                    user_id: 1,
                    last_name: "Smith",
                    first_name: "John",
                    email: "john@gmail.com",
                    valid_email: true,
                    is_admin: true,
                    organisation: "LOV",
                    country: "France",
                    user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                    user_creation_date: '2023-08-01 10:30:00'
                }],
                total: 1
            }
            const options = {
                page: 1,
                limit: 10,
                sort_by: [],
                filter: [{ field: "deleted", operator: "=", value: "true" }]
            }

            jest.spyOn(mockUserDataSource, "getAll").mockImplementation(() => Promise.resolve(expectedData))
            try {
                await userRepository.standardGetUsers(options);
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : filter field : deleted")
            }
            // exceptget all have been called with
            expect(mockUserDataSource.getAll).not.toBeCalled()
        });

    })

    describe("CreateUser", () => {
        test("Should return created user user_id", async () => {
            const inputData: UserRequestCreationModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "123test!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }

            jest.spyOn(mockUserDataSource, "create").mockImplementation(() => Promise.resolve(1))
            jest.spyOn(mockBcryptAdapter, "hash").mockImplementation(() => Promise.resolve("$2b$12$mMHjmPmUFsTrYFa3WUEVs.T1vaMz4q55FTfgpB.rNiL4GTt85BRkW"))
            const result = await userRepository.createUser(inputData);
            expect(result).toBe(1)
        });
    })

    describe("GetUser", () => {
        test("Should return one user", async () => {
            const inputData = { user_id: 1 }
            const expectedData: UserResponseModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: true,
                is_admin: false,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }
            jest.spyOn(mockUserDataSource, "getOne").mockImplementation(() => Promise.resolve(expectedData))
            const result = await userRepository.getUser(inputData);
            expect(result).toBe(expectedData)
        });
    })

    describe("VerifyUserLogin", () => {
        test("Should return true", async () => {
            const InputData: AuthUserCredentialsModel = {
                email: "test@email.com",
                password: "good_password"
            }
            const OutputData: AuthUserCredentialsModel = {
                email: "test@email.com",
                password: "hashed_password"
            }
            jest.spyOn(mockUserDataSource, "getUserLogin").mockImplementation(() => Promise.resolve(OutputData))
            jest.spyOn(mockBcryptAdapter, "compare").mockImplementation(() => Promise.resolve(true))

            const result = await userRepository.verifyUserLogin(InputData);
            expect(result).toBe(true)

        });
        test("Should handle bas password and return false", async () => {
            const InputData: AuthUserCredentialsModel = {
                email: "test@email.com",
                password: "bad_password"
            }
            const OutputData: AuthUserCredentialsModel = {
                email: "test@email.com",
                password: "hashed_password"
            }
            jest.spyOn(mockUserDataSource, "getUserLogin").mockImplementation(() => Promise.resolve(OutputData))
            jest.spyOn(mockBcryptAdapter, "compare").mockImplementation(() => Promise.resolve(false))

            const result = await userRepository.verifyUserLogin(InputData);
            expect(result).toBe(false)

        });
        test("Should handle bad email and  return false", async () => {
            const InputData: AuthUserCredentialsModel = {
                email: "bad_test@email.com",
                password: "bad_password"
            }

            jest.spyOn(mockUserDataSource, "getUserLogin").mockImplementation(() => Promise.resolve(null))
            jest.spyOn(mockBcryptAdapter, "compare").mockImplementation(() => Promise.resolve(false))

            const result = await userRepository.verifyUserLogin(InputData);
            expect(result).toBe(false)

        });

        test("Should handle crach in sub functions and return false", async () => {
            const InputData: AuthUserCredentialsModel = {
                email: "bad_test@email.com",
                password: "bad_password"
            }

            jest.spyOn(mockUserDataSource, "getUserLogin").mockImplementation(() => { throw new Error() })
            jest.spyOn(mockBcryptAdapter, "compare").mockImplementation(() => { throw new Error() })

            const result = await userRepository.verifyUserLogin(InputData);
            expect(result).toBe(false)

        });
    });

    describe("VerifyValidationToken", () => {
        test("Should decode token and return it", async () => {
            const InputData: string = "validation_token"

            const OutputData: DecodedToken = decodedToken
            jest.spyOn(jwtAdapter, "verify").mockImplementation(() => Promise.resolve(OutputData))

            const result = await userRepository.verifyValidationToken(InputData);
            expect(result).toBe(OutputData)
            expect(jwtAdapter.verify).toHaveBeenCalledWith(InputData, TEST_VALIDATION_TOKEN_SECRET)
        });

        test("should handle error and return null", async () => {
            const InputData: string = "validation_token"

            jest.spyOn(jwtAdapter, "verify").mockImplementation(() => { throw new Error() })

            const result = await userRepository.verifyValidationToken(InputData);
            expect(result).toBe(null)

        });
    });

    describe("verifyResetPasswordToken", () => {
        test("Should decode token and return it", async () => {
            const InputData: string = "validation_token"

            const OutputData: DecodedToken = decodedToken

            jest.spyOn(jwtAdapter, "verify").mockImplementation(() => Promise.resolve(OutputData))

            const result = await userRepository.verifyResetPasswordToken(InputData);
            expect(result).toBe(OutputData)
            expect(jwtAdapter.verify).toHaveBeenCalledWith(InputData, TEST_RESET_PASSWORD_TOKEN_SECRET)

        });

        test("should handle error and return null", async () => {
            const InputData: string = "validation_token"

            jest.spyOn(jwtAdapter, "verify").mockImplementation(() => { throw new Error() })

            const result = await userRepository.verifyResetPasswordToken(InputData);
            expect(result).toBe(null)

        });
    });

    describe("UpdateUser", () => {

        test("Things to update : any user try to validate his unvalidated account", async () => {
            const user_to_update: UserUpdateModel = {
                user_id: 2,
                confirmation_code: undefined,
                valid_email: true
            }
            const filtred_user: UserUpdateModel = {
                user_id: 2,
                confirmation_code: undefined,
                valid_email: true
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(1))

            const result = await userRepository.validUser(user_to_update);

            expect(mockUserDataSource.updateOne).toHaveBeenCalledWith(filtred_user)
            expect(result).toBe(1)
        });

        test("Things to update : admin user try do edit admin property", async () => {
            const user_to_update: UserUpdateModel = {
                user_id: 2,
                valid_email: true,
                is_admin: true
            }
            const filtred_user: UserUpdateModel = {
                user_id: 2,
                valid_email: true,
                is_admin: true
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(1))

            const result = await userRepository.adminUpdateUser(user_to_update);

            expect(mockUserDataSource.updateOne).toHaveBeenCalledWith(filtred_user)
            expect(result).toBe(1)
        });
        test("Things to update : admin user try to edit standard property", async () => {
            const user_to_update: UserUpdateModel = {
                user_id: 2,
                last_name: "Smith",
                first_name: "Joan"
            }
            const filtred_user: UserUpdateModel = {
                user_id: 2,
                last_name: "Smith",
                first_name: "Joan"
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(1))

            const result = await userRepository.adminUpdateUser(user_to_update);

            expect(mockUserDataSource.updateOne).toHaveBeenCalledWith(filtred_user)
            expect(result).toBe(1)
        });

        //TODO ID != USER_ID
        test("Nothing to update : admin user try to edit existing property that could not be acess", async () => {
            const user_to_update: UserUpdateModel = {
                id: 2,
                password_hash: "$2b$12$AiyRbTXIq/XHx49nOOUsreHPUB79yBqOy0P5CJY83pONscWYDQyOy",
                user_id: 3
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(0))
            try {
                await userRepository.adminUpdateUser(user_to_update);
            }
            catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : id, password_hash")
            }
            expect(mockUserDataSource.updateOne).not.toBeCalled();
        });

        test("Nothing to update : admin user try to edit existing property that don't exist", async () => {
            const user_to_update: UserUpdateModel = {
                user_id: 2,
                toto: "$2b$12$AiyRbTXIq/XHx49nOOUsreHPUB79yBqOy0P5CJY83pONscWYDQyOy",
                tutu: 3
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(0))

            try {
                await userRepository.adminUpdateUser(user_to_update);
            }
            catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : toto, tutu")
            }
            expect(mockUserDataSource.updateOne).not.toBeCalled();
        });

        test("Some things to update : Mix between allowed and unallowed property", async () => {
            const user_to_update: UserUpdateModel = {
                user_id: 2,
                valid_email: true,
                last_name: "Smith",
                toto: "ZERTYU",
                password_hash: "$2b$12$AiyRbTXIq/XHx49nOOUsreHPUB79yBqOy0P5CJY83pONscWYDQyOy",
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(0))

            try {
                await userRepository.adminUpdateUser(user_to_update);
            }
            catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : toto, password_hash")
            }

            expect(mockUserDataSource.updateOne).not.toBeCalled();
        });

        test("Things to update : standard user try do edit admin property", async () => {
            const user_to_update: UserUpdateModel = {
                user_id: 2,
                status: "Active",
                is_admin: true
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(0))

            try {
                await userRepository.standardUpdateUser(user_to_update);
            }
            catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : status, is_admin")
            }
            expect(mockUserDataSource.updateOne).not.toBeCalled();
        });
        test("Things to update : standard user try to edit standard property", async () => {
            const user_to_update: UserUpdateModel = {
                user_id: 2,
                last_name: "Smith",
                first_name: "Joan"
            }
            const filtred_user: UserUpdateModel = {
                user_id: 2,
                last_name: "Smith",
                first_name: "Joan"
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(1))

            const result = await userRepository.standardUpdateUser(user_to_update);

            expect(mockUserDataSource.updateOne).toHaveBeenCalledWith(filtred_user)
            expect(result).toBe(1)
        });

        test("Nothing to update : standard user try to edit existing property that could not be acess", async () => {
            const user_to_update: UserUpdateModel = {
                id: 2,
                password_hash: "$2b$12$AiyRbTXIq/XHx49nOOUsreHPUB79yBqOy0P5CJY83pONscWYDQyOy",
                user_id: 3
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(0))

            try {
                await userRepository.standardUpdateUser(user_to_update);
            }
            catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : id, password_hash")
            }
            expect(mockUserDataSource.updateOne).not.toBeCalled();
        });

        test("Nothing to update : standard user try to edit existing property that don't exist", async () => {
            const user_to_update: UserUpdateModel = {
                user_id: 2,
                toto: "$2b$12$AiyRbTXIq/XHx49nOOUsreHPUB79yBqOy0P5CJY83pONscWYDQyOy",
                tutu: 3
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(0))

            try {
                await userRepository.standardUpdateUser(user_to_update);
            }
            catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : toto, tutu")
            }

            expect(mockUserDataSource.updateOne).not.toBeCalled();
        });

        test("Some things to update : Mix between allowed and unallowed property", async () => {
            const user_to_update: UserUpdateModel = {
                user_id: 2,
                status: 'Active',
                last_name: "Smith",
                toto: "ZERTYU",
                password_hash: "$2b$12$AiyRbTXIq/XHx49nOOUsreHPUB79yBqOy0P5CJY83pONscWYDQyOy",
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(0))
            try {
                await userRepository.standardUpdateUser(user_to_update);
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : status, toto, password_hash")
            }
            expect(mockUserDataSource.updateOne).not.toBeCalled();
        });

    });

    describe("IsAdmin", () => {
        test("Should return true for an admin user", async () => {
            const adminUser: UserResponseModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: true,
                is_admin: true,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }
            jest.spyOn(mockUserDataSource, "getOne").mockImplementation(() => Promise.resolve(adminUser))

            const result = await userRepository.isAdmin(1);
            expect(result).toBe(true)
        });
        test("Should return false for a non admin user", async () => {
            const nonAdminUser: UserResponseModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: true,
                is_admin: false,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }
            jest.spyOn(mockUserDataSource, "getOne").mockImplementation(() => Promise.resolve(nonAdminUser))

            const result = await userRepository.isAdmin(1);
            expect(result).toBe(false)
        });
        test("Should return false for a non existing user", async () => {
            jest.spyOn(mockUserDataSource, "getOne").mockImplementation(() => Promise.resolve(null))
            const result = await userRepository.isAdmin(1);
            expect(result).toBe(false)
        });
    });

    describe("GenerateValidationToken", () => {
        test("Should return true for an admin user", async () => {
            const User: UserRequestModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: false,
                confirmation_code: "123456",
                is_admin: false,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }

            jest.spyOn(jwtAdapter, "sign").mockImplementation(() => { return "validation_token" })

            const result = await userRepository.generateValidationToken(User);

            expect(jwtAdapter.sign).toHaveBeenCalledWith(
                { user_id: 1, confirmation_code: "123456" },
                TEST_VALIDATION_TOKEN_SECRET,
                { expiresIn: '24h' })
            expect(result).toBe("validation_token")

        });
    });

    describe("GenerateResetPasswordToken", () => {
        test("Should return generated token ", async () => {
            const User: UserRequestModel = {
                user_id: 1,
                reset_password_code: "123456",
            }

            jest.spyOn(jwtAdapter, "sign").mockImplementation(() => { return "reset_password_token" })

            const result = await userRepository.generateResetPasswordToken(User);

            expect(jwtAdapter.sign).toHaveBeenCalledWith(
                { user_id: 1, reset_password_code: "123456" },
                TEST_RESET_PASSWORD_TOKEN_SECRET,
                { expiresIn: '3h' })
            expect(result).toBe("reset_password_token")

        });
    });

    describe("setResetPasswordCode", () => {
        test("Should set reset password code", async () => {
            const inputData: UserUpdateModel = {
                user_id: 1,
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(1))
            const result = await userRepository.setResetPasswordCode(inputData);
            expect(result).toBe(1)
            expect(mockUserDataSource.updateOne).toHaveBeenCalledWith({ user_id: 1, reset_password_code: expect.any(String) })
        });
    });

    describe("changePassword", () => {
        test("Should return 1 in nominal case", async () => {

            const credentials: ChangeCredentialsModel = {
                user_id: 1,
                password: "current_password",
                new_password: "new_password"
            }

            jest.spyOn(mockBcryptAdapter, "hash").mockImplementation(() => Promise.resolve("$2b$12$mMHjmPmUFsTrYFa3WUEVs.T1vaMz4q55FTfgpB.rNiL4GTt85BRkW"))
            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(1))
            const result = await userRepository.changePassword(credentials);

            expect(mockBcryptAdapter.hash).toHaveBeenCalledWith("new_password")
            expect(mockUserDataSource.updateOne).toHaveBeenCalledWith({ user_id: 1, password_hash: "$2b$12$mMHjmPmUFsTrYFa3WUEVs.T1vaMz4q55FTfgpB.rNiL4GTt85BRkW", reset_password_code: null })
            expect(result).toBe(1)

        });

        test("Should return 0 if no user updated", async () => {
            const credentials: ChangeCredentialsModel = {
                user_id: 1,
                password: "current_password",
                new_password: "new_password"
            }

            jest.spyOn(mockBcryptAdapter, "hash").mockImplementation(() => Promise.resolve("$2b$12$mMHjmPmUFsTrYFa3WUEVs.T1vaMz4q55FTfgpB.rNiL4GTt85BRkW"))
            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(0))
            const result = await userRepository.changePassword(credentials);

            expect(mockBcryptAdapter.hash).toHaveBeenCalledWith("new_password")
            expect(mockUserDataSource.updateOne).toHaveBeenCalledWith({ user_id: 1, password_hash: "$2b$12$mMHjmPmUFsTrYFa3WUEVs.T1vaMz4q55FTfgpB.rNiL4GTt85BRkW", reset_password_code: null })
            expect(result).toBe(0)

        });
    });

    describe("toPublicUser", () => {
        test("Should return one user", async () => {
            const inputData: PrivateUserModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: true,
                is_admin: false,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00',
                password_hash: "code",
                confirmation_code: "code",
                reset_password_code: "code"
            }

            const expectedData: PublicUserModel = {
                user_id: 1,
                first_name: 'John',
                last_name: 'Smith',
                email: 'john@gmail.com',
                is_admin: false,
                organisation: 'LOV',
                country: 'France',
                user_planned_usage: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
                user_creation_date: '2023-08-01 10:30:00'
            }
            const result: PublicUserModel = userRepository.toPublicUser(inputData);
            expect(result).toStrictEqual(expectedData)
        });
    })
    describe("IsDeleted", () => {
        test("Should return true for a deleted user", async () => {
            const deletedUser: UserResponseModel = {
                user_id: 1,
                last_name: "anonym_1",
                first_name: "anonym_1",
                email: "anonym_1",
                valid_email: false,
                is_admin: false,
                organisation: "anonymized",
                country: "anonymized",
                user_planned_usage: "anonymized",
                user_creation_date: '2023-08-01 10:30:00',
                deleted: '2023-08-01 10:30:00',
            }
            jest.spyOn(mockUserDataSource, "getOne").mockImplementation(() => Promise.resolve(deletedUser))

            const result = await userRepository.isDeleted(1);
            expect(result).toBe(true)
        });
        test("Should return false for a non deleted user", async () => {
            const nonDeletedUser: UserResponseModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                valid_email: true,
                is_admin: false,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }
            jest.spyOn(mockUserDataSource, "getOne").mockImplementation(() => Promise.resolve(nonDeletedUser))

            const result = await userRepository.isDeleted(1);
            expect(result).toBe(false)
        });

        test("Should return false for a non existing user", async () => {
            jest.spyOn(mockUserDataSource, "getOne").mockImplementation(() => Promise.resolve(null))
            const result = await userRepository.isDeleted(1);
            expect(result).toBe(false)
        });
    });

    describe("DeleteUser", () => {

        test("user deletion is a sucess", async () => {
            const deletedUser: UserUpdateModel = {
                user_id: 1,
                last_name: "anonym_1",
                first_name: "anonym_1",
                email: "anonym_1",
                valid_email: false,
                confirmation_code: null,
                is_admin: false,
                organisation: "anonymized",
                country: "anonymized",
                user_planned_usage: "anonymized",
                password_hash: "anonymized",
                reset_password_code: null,
                deleted: "2021-08-10T00:00:00.000Z"
            }
            const nonDeletedUser: UserUpdateModel = {
                user_id: 1,

            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(1))
            jest.spyOn(Date, "now").mockImplementation(() => 1628580000000)
            jest.spyOn(Date.prototype, "toISOString").mockImplementation(() => "2021-08-10T00:00:00.000Z")

            const result = await userRepository.deleteUser(nonDeletedUser);

            expect(mockUserDataSource.updateOne).toHaveBeenCalledWith(deletedUser)
            expect(result).toBe(1)
        });

        test("user deletion is a failure", async () => {
            const deletedUser: UserUpdateModel = {
                user_id: 1,
                last_name: "anonym_1",
                first_name: "anonym_1",
                email: "anonym_1",
                valid_email: false,
                confirmation_code: null,
                is_admin: false,
                organisation: "anonymized",
                country: "anonymized",
                user_planned_usage: "anonymized",
                password_hash: "anonymized",
                reset_password_code: null,
                deleted: "2021-08-10T00:00:00.000Z"
            }
            const nonDeletedUser: UserUpdateModel = {
                user_id: 1,

            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(0))
            jest.spyOn(Date, "now").mockImplementation(() => 1628580000000)
            jest.spyOn(Date.prototype, "toISOString").mockImplementation(() => "2021-08-10T00:00:00.000Z")

            const result = await userRepository.deleteUser(nonDeletedUser);

            expect(mockUserDataSource.updateOne).toHaveBeenCalledWith(deletedUser)
            expect(result).toBe(0)
        });
    });
})
