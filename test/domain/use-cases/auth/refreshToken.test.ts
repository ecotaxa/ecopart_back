import { UserResponseModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { AuthRepository } from "../../../../src/domain/interfaces/repositories/auth-repository";
import { RefreshToken } from '../../../../src/domain/use-cases/auth/refreshToken'
import { AuthJwtRefreshedResponseModel, DecodedToken } from "../../../../src/domain/entities/auth";

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

        const InputUserData = {
            user_id: 1,
            first_name: 'John',
            last_name: 'Smith',
            email: 'john@gmail.com',
            is_admin: false,
            valid_email: true,
            status: 'Pending',
            organisation: 'LOV',
            country: 'France',
            user_planned_usage: 'Mon usage',
            user_creation_date: '2023-07-31 17:18:47',

            iat: 1693237789,
            exp: 1724795389
        }
        const OutputUserData: UserResponseModel = {
            user_id: 1,
            first_name: 'John',
            last_name: 'Smith',
            email: 'john@gmail.com',
            is_admin: false,
            valid_email: true,
            organisation: 'LOV',
            country: 'France',
            user_planned_usage: 'Mon usage',
            user_creation_date: '2023-07-31 17:18:47',
        }
        const OutputAuthData: AuthJwtRefreshedResponseModel = {
            jwt: "refreshed_token",
        }

        jest.spyOn(mockAuthRepository, "generateAccessToken").mockImplementation(() => { return "refreshed_token" })
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputUserData))
        const loginUserUseCase = new RefreshToken(mockUserRepository, mockAuthRepository)
        const result = await loginUserUseCase.execute(InputUserData);
        expect(result).toStrictEqual(OutputAuthData);
    });
    test("should return loged user and auth tokens", async () => {

        const InputUserData: DecodedToken = {
            user_id: 1,
            first_name: 'John',
            last_name: 'Smith',
            email: 'john@gmail.com',
            is_admin: false,
            valid_email: true,
            organisation: 'LOV',
            country: 'France',
            user_planned_usage: 'Mon usage',
            user_creation_date: '2023-07-31 17:18:47',

            iat: 1693237789,
            exp: 1724795389
        }

        jest.spyOn(mockAuthRepository, "generateAccessToken").mockImplementation(() => { return "refreshed_token" })
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(null))
        const loginUserUseCase = new RefreshToken(mockUserRepository, mockAuthRepository)
        try {
            const result = await loginUserUseCase.execute(InputUserData);
            expect(result).toBe(true);
        } catch (err) {
            expect(err.message).toBe("Can't find user");
        }
    });
})
