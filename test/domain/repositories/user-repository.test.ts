//test/domain/repositories/user-repository.test.ts
import { UserDataSource } from "../../../src/data/interfaces/data-sources/user-data-source";
import { AuthUserCredentialsModel } from "../../../src/domain/entities/auth";
import { UserRequesCreationtModel, UserResponseModel } from "../../../src/domain/entities/user";
import { UserRepository } from "../../../src/domain/interfaces/repositories/user-repository";
import { UserRepositoryImpl } from "../../../src/domain/repositories/user-repository";
import { BcryptAdapter } from "../../../src/infra/cryptography/bcript"
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

describe("User Repository", () => {
    let mockUserDataSource: UserDataSource;
    let mockBcryptAdapter: BcryptAdapter;
    let userRepository: UserRepository

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserDataSource = new MockUserDataSource()
        mockBcryptAdapter = new MockBcryptAdapter()
        userRepository = new UserRepositoryImpl(mockUserDataSource, mockBcryptAdapter)
    })

    describe("getAllUsers", () => {
        test("should return data", async () => {
            const expectedData: UserResponseModel[] = [{
                id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                status: "Pending",
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

    describe("createUser", () => {
        test("should return created user id", async () => {
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

    describe("getUser", () => {
        test("should return one user", async () => {
            const inputData = { id: 1 }
            const expectedData: UserResponseModel = {
                id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                status: "Pending",
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

    describe("verifyUserLogin", () => {
        test("should return true", async () => {
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
        test("should handle bas password and return false", async () => {
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
        test("should handle bad email and  return false", async () => {
            const InputData: AuthUserCredentialsModel = {
                email: "bad_test@email.com",
                password: "bad_password"
            }

            jest.spyOn(mockUserDataSource, "getUserLogin").mockImplementation(() => Promise.resolve(null))
            jest.spyOn(mockBcryptAdapter, "compare").mockImplementation(() => Promise.resolve(false))

            const result = await userRepository.verifyUserLogin(InputData);
            expect(result).toBe(false)

        });
    });
})
