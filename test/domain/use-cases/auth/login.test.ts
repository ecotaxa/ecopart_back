import { UserResponseModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { AuthRepository } from "../../../../src/domain/interfaces/repositories/auth-repository";
import { LoginUser } from '../../../../src/domain/use-cases/auth/login'
import { AuthJwtResponseModel, AuthUserCredentialsModel } from "../../../../src/domain/entities/auth";

describe("Create User Use Case", () => {
    class MockUserRepository implements UserRepository {
        adminUpdateUser(): Promise<number | null> {
            throw new Error("Method not implemented.");
        }
        standardUpdateUser(): Promise<number | null> {
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
    }
    class MockAuthRepository implements AuthRepository {
        generateAccessToken(): string {
            throw new Error("Method not implemented.");
        }
        generateRefreshToken(): string {
            throw new Error("Method not implemented.");
        }
    }

    let mockUserRepository: UserRepository;
    let mockAuthRepository: AuthRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository()
        mockAuthRepository = new MockAuthRepository()
    })

    test("should return loged user and auth tokens", async () => {
        const InputData: AuthUserCredentialsModel = {
            email: "test@email.com",
            password: "good_password"
        }
        const OutputUserData: UserResponseModel = {
            id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            status: "Pending",
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }
        const OutputAuthData: AuthJwtResponseModel = {
            jwt: "access_token",
            jwt_refresh: "refresh_token",
        }

        jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputUserData))
        jest.spyOn(mockAuthRepository, "generateAccessToken").mockImplementation(() => { return "access_token" })
        jest.spyOn(mockAuthRepository, "generateRefreshToken").mockImplementation(() => { return "refresh_token" })
        const loginUserUseCase = new LoginUser(mockUserRepository, mockAuthRepository)
        const result = await loginUserUseCase.execute(InputData);
        expect(result).toStrictEqual({ ...OutputUserData, ...OutputAuthData });
    });

    test("should handle bad credentials and return null", async () => {
        const InputData: AuthUserCredentialsModel = {
            email: "test@email.com",
            password: "bad_password"
        }
        const OutputUserData: UserResponseModel = {
            id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            status: "Pending",
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }

        jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputUserData))
        jest.spyOn(mockAuthRepository, "generateAccessToken").mockImplementation(() => { return "access_token" })
        jest.spyOn(mockAuthRepository, "generateRefreshToken").mockImplementation(() => { return "refresh_token" })
        const loginUserUseCase = new LoginUser(mockUserRepository, mockAuthRepository)
        const result = await loginUserUseCase.execute(InputData);
        expect(result).toStrictEqual(null);
    });

    test("should handle error during fetching user and return null", async () => {
        const InputData: AuthUserCredentialsModel = {
            email: "test@email.com",
            password: "good_password"
        }

        jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(null))
        jest.spyOn(mockAuthRepository, "generateAccessToken").mockImplementation(() => { return "access_token" })
        jest.spyOn(mockAuthRepository, "generateRefreshToken").mockImplementation(() => { return "refresh_token" })
        const loginUserUseCase = new LoginUser(mockUserRepository, mockAuthRepository)
        const result = await loginUserUseCase.execute(InputData);
        expect(result).toStrictEqual(null);
    });

})
