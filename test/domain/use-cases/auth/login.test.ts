import { UserResponseModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { AuthRepository } from "../../../../src/domain/interfaces/repositories/auth-repository";
import { LoginUser } from '../../../../src/domain/use-cases/auth/login'
import { AuthJwtResponseModel, AuthUserCredentialsModel, DecodedToken } from "../../../../src/domain/entities/auth";
import { SearchResult } from "../../../../src/domain/entities/search";

describe("Create User Use Case", () => {
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

    test("Should return loged user and auth tokens", async () => {
        const InputData: AuthUserCredentialsModel = {
            email: "test@email.com",
            password: "good_password"
        }
        const OutputUserData: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: true,
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
        jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockAuthRepository, "generateAccessToken").mockImplementation(() => { return "access_token" })
        jest.spyOn(mockAuthRepository, "generateRefreshToken").mockImplementation(() => { return "refresh_token" })
        const loginUserUseCase = new LoginUser(mockUserRepository, mockAuthRepository)
        const result = await loginUserUseCase.execute(InputData);
        expect(result).toStrictEqual({ ...OutputUserData, ...OutputAuthData });
    });

    test("Should handle bad credentials and throw error", async () => {
        const InputData: AuthUserCredentialsModel = {
            email: "test@email.com",
            password: "bad_password"
        }
        const OutputUserData: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }

        jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputUserData))
        jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockAuthRepository, "generateAccessToken").mockImplementation(() => { return "access_token" })
        jest.spyOn(mockAuthRepository, "generateRefreshToken").mockImplementation(() => { return "refresh_token" })
        const loginUserUseCase = new LoginUser(mockUserRepository, mockAuthRepository)
        try {
            const result = await loginUserUseCase.execute(InputData);
            // Should not go there
            expect(result).toBe(true);
        } catch (err) {
            expect(err.message).toBe("Invalid credentials");
        }
    });

    test("Should handle user with unverified email and throw error", async () => {
        const InputData: AuthUserCredentialsModel = {
            email: "test@email.com",
            password: "bad_password"
        }
        const OutputUserData: UserResponseModel = {
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

        jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputUserData))
        jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockAuthRepository, "generateAccessToken").mockImplementation(() => { return "access_token" })
        jest.spyOn(mockAuthRepository, "generateRefreshToken").mockImplementation(() => { return "refresh_token" })
        const loginUserUseCase = new LoginUser(mockUserRepository, mockAuthRepository)
        try {
            const result = await loginUserUseCase.execute(InputData);
            // Should not go there
            expect(result).toBe(true);
        } catch (err) {
            expect(err.message).toBe("User email not verified");
        }
    });

    test("Should handle error during fetching user and and throw error", async () => {
        const InputData: AuthUserCredentialsModel = {
            email: "test@email.com",
            password: "good_password"
        }

        jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(null))
        jest.spyOn(mockAuthRepository, "generateAccessToken").mockImplementation(() => { return "access_token" })
        jest.spyOn(mockAuthRepository, "generateRefreshToken").mockImplementation(() => { return "refresh_token" })
        const loginUserUseCase = new LoginUser(mockUserRepository, mockAuthRepository)
        try {
            const result = await loginUserUseCase.execute(InputData);
            // Should not go there
            expect(result).toBe(true);
        } catch (err) {
            expect(err.message).toBe("Can't find user");
        }
    });

    test("Should handle deleted user and throw error", async () => {
        const InputData: AuthUserCredentialsModel = {
            email: "test@email.com",
            password: "good_password"
        }
        const OutputUserData: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }

        jest.spyOn(mockUserRepository, "verifyUserLogin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputUserData))
        jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockAuthRepository, "generateAccessToken").mockImplementation(() => { return "access_token" })
        jest.spyOn(mockAuthRepository, "generateRefreshToken").mockImplementation(() => { return "refresh_token" })
        const loginUserUseCase = new LoginUser(mockUserRepository, mockAuthRepository)
        try {
            const result = await loginUserUseCase.execute(InputData);
            // Should not go there
            expect(result).toBe(true);
        } catch (err) {
            expect(err.message).toBe("User is deleted");
        }
    });
})
