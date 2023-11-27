//test/domain/repositories/user-repository.test.ts
import { UserDataSource } from "../../../src/data/interfaces/data-sources/user-data-source";
import { AuthUserCredentialsModel, DecodedToken } from "../../../src/domain/entities/auth";
import { UserRequesCreationtModel, UserRequestModel, UserResponseModel, UserUpdateModel } from "../../../src/domain/entities/user";
import { UserRepository } from "../../../src/domain/interfaces/repositories/user-repository";
import { UserRepositoryImpl } from "../../../src/domain/repositories/user-repository";
import { BcryptAdapter } from "../../../src/infra/cryptography/bcript"
import { JwtAdapter } from "../../../src/infra/auth/jsonwebtoken"
import 'dotenv/config'
import { JwtPayload } from "jsonwebtoken";

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
    getAll(): Promise<UserResponseModel[]> {
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
        userRepository = new UserRepositoryImpl(mockUserDataSource, mockBcryptAdapter, jwtAdapter, TEST_VALIDATION_TOKEN_SECRET)
    })

    describe("GetAllUsers", () => {
        test("Should return data", async () => {
            const expectedData: UserResponseModel[] = [{
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
            }]

            jest.spyOn(mockUserDataSource, "getAll").mockImplementation(() => Promise.resolve(expectedData))
            const result = await userRepository.getUsers();
            expect(result).toBe(expectedData)
        });
    })

    describe("CreateUser", () => {
        test("Should return created user user_id", async () => {
            const inputData: UserRequesCreationtModel = {
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

            const OutputData: DecodedToken = {
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
                user_creation_date: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }

            jest.spyOn(jwtAdapter, "verify").mockImplementation(() => Promise.resolve(OutputData))

            const result = await userRepository.verifyValidationToken(InputData);
            expect(result).toBe(OutputData)

        });
        test("should handle error and return null", async () => {
            const InputData: string = "validation_token"

            jest.spyOn(jwtAdapter, "verify").mockImplementation(() => { throw new Error() })

            const result = await userRepository.verifyValidationToken(InputData);
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

            const result = await userRepository.adminUpdateUser(user_to_update);

            expect(mockUserDataSource.updateOne).not.toBeCalled();
            expect(result).toBe(0)
        });

        test("Nothing to update : admin user try to edit existing property that don't exist", async () => {
            const user_to_update: UserUpdateModel = {
                user_id: 2,
                toto: "$2b$12$AiyRbTXIq/XHx49nOOUsreHPUB79yBqOy0P5CJY83pONscWYDQyOy",
                tutu: 3
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(0))

            const result = await userRepository.adminUpdateUser(user_to_update);

            expect(mockUserDataSource.updateOne).not.toBeCalled();
            expect(result).toBe(0)
        });

        test("Some things to update : Mix between allowed and unallowed property", async () => {
            const user_to_update: UserUpdateModel = {
                user_id: 2,
                valid_email: true,
                last_name: "Smith",
                toto: "ZERTYU",
                password_hash: "$2b$12$AiyRbTXIq/XHx49nOOUsreHPUB79yBqOy0P5CJY83pONscWYDQyOy",
            }
            const filtred_user: UserUpdateModel = {
                user_id: 2,
                valid_email: true,
                last_name: "Smith"
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(0))

            const result = await userRepository.adminUpdateUser(user_to_update);

            expect(mockUserDataSource.updateOne).toHaveBeenCalledWith(filtred_user)
            expect(result).toBe(0)
        });

        test("Things to update : standard user try do edit admin property", async () => {
            const user_to_update: UserUpdateModel = {
                user_id: 2,
                status: "Active",
                is_admin: true
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(0))

            const result = await userRepository.standardUpdateUser(user_to_update);

            expect(mockUserDataSource.updateOne).not.toBeCalled();
            expect(result).toBe(0)
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

            const result = await userRepository.standardUpdateUser(user_to_update);

            expect(mockUserDataSource.updateOne).not.toBeCalled();
            expect(result).toBe(0)
        });

        test("Nothing to update : standard user try to edit existing property that don't exist", async () => {
            const user_to_update: UserUpdateModel = {
                user_id: 2,
                toto: "$2b$12$AiyRbTXIq/XHx49nOOUsreHPUB79yBqOy0P5CJY83pONscWYDQyOy",
                tutu: 3
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(0))

            const result = await userRepository.standardUpdateUser(user_to_update);

            expect(mockUserDataSource.updateOne).not.toBeCalled();
            expect(result).toBe(0)
        });

        test("Some things to update : Mix between allowed and unallowed property", async () => {
            const user_to_update: UserUpdateModel = {
                user_id: 2,
                status: 'Active',
                last_name: "Smith",
                toto: "ZERTYU",
                password_hash: "$2b$12$AiyRbTXIq/XHx49nOOUsreHPUB79yBqOy0P5CJY83pONscWYDQyOy",
            }
            const filtred_user: UserUpdateModel = {
                user_id: 2,
                last_name: "Smith"
            }

            jest.spyOn(mockUserDataSource, "updateOne").mockImplementation(() => Promise.resolve(0))

            const result = await userRepository.standardUpdateUser(user_to_update);

            expect(mockUserDataSource.updateOne).toHaveBeenCalledWith(filtred_user)
            expect(result).toBe(0)
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

})
