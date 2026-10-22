import { UserResponseModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { AuthRepository } from "../../../../src/domain/interfaces/repositories/auth-repository";
import { RefreshToken } from '../../../../src/domain/use-cases/auth/refresh-token'
import { AuthJwtRefreshedResponseModel, DecodedToken } from "../../../../src/domain/entities/auth";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockAuthRepository } from "../../../mocks/auth-mock";

describe("Create User Use Case", () => {

    let mockUserRepository: UserRepository;
    let mockAuthRepository: AuthRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository()
        mockAuthRepository = new MockAuthRepository()
    })

    test("Should return loged user and auth tokens", async () => {

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
            user_creation_utc_date_time: '2023-07-31 17:18:47',
            sid: 'session-1',

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
            user_creation_utc_date_time: '2023-07-31 17:18:47',
        }
        const OutputAuthData: AuthJwtRefreshedResponseModel = {
            jwt: "refreshed_token",
            jwt_refresh: "reissued_refresh_token",
        }

        jest.spyOn(mockAuthRepository, "generateAccessToken").mockImplementation(() => { return "refreshed_token" })
        jest.spyOn(mockAuthRepository, "generateRefreshToken").mockImplementation(() => { return "reissued_refresh_token" })
        jest.spyOn(mockAuthRepository, "ensureSessionIsActive").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockAuthRepository, "extendSession").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputUserData))
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())

        const loginUserUseCase = new RefreshToken(mockUserRepository, mockAuthRepository)
        const result = await loginUserUseCase.execute(InputUserData);
        expect(result).toStrictEqual(OutputAuthData);
        // By id, not by email: an email can be reassigned to another account
        expect(mockUserRepository.getUser).toBeCalledWith({ user_id: 1 });
        // Same session, checked then extended; both tokens carry it
        expect(mockAuthRepository.ensureSessionIsActive).toBeCalledWith('session-1', 1);
        expect(mockAuthRepository.extendSession).toBeCalledWith('session-1');
        expect(mockAuthRepository.generateAccessToken).toBeCalledWith(OutputUserData, 'session-1');
        expect(mockAuthRepository.generateRefreshToken).toBeCalledWith(OutputUserData, 'session-1');
    });

    test("Refuses a revoked or expired session, and a token issued before sessions existed", async () => {
        const OutputUserData: UserResponseModel = {
            user_id: 1, first_name: 'John', last_name: 'Smith', email: 'john@gmail.com', is_admin: false, valid_email: true,
            organisation: 'LOV', country: 'France', user_planned_usage: 'Mon usage', user_creation_utc_date_time: '2023-07-31 17:18:47',
        }
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputUserData))
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockAuthRepository, "ensureSessionIsActive").mockImplementation(() => Promise.reject(new Error("Session revoked or expired")))
        jest.spyOn(mockAuthRepository, "extendSession")
        jest.spyOn(mockAuthRepository, "generateAccessToken")

        const refresh = new RefreshToken(mockUserRepository, mockAuthRepository)
        await expect(refresh.execute({ ...OutputUserData, sid: 'revoked-session' })).rejects.toThrow("Session revoked or expired");
        await expect(refresh.execute({ ...OutputUserData })).rejects.toThrow("Session revoked or expired");
        expect(mockAuthRepository.ensureSessionIsActive).toHaveBeenNthCalledWith(2, undefined, 1);
        expect(mockAuthRepository.extendSession).toBeCalledTimes(0);
        expect(mockAuthRepository.generateAccessToken).toBeCalledTimes(0);
    });
    test("Cannot find user ", async () => {

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
            user_creation_utc_date_time: '2023-07-31 17:18:47',

            iat: 1693237789,
            exp: 1724795389
        }

        jest.spyOn(mockAuthRepository, "generateAccessToken").mockImplementation(() => { return "refreshed_token" })
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(null))
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed")

        const loginUserUseCase = new RefreshToken(mockUserRepository, mockAuthRepository)
        try {
            const result = await loginUserUseCase.execute(InputUserData);
            expect(result).toBe(true);
        } catch (err) {
            expect(err.message).toBe("Cannot find user");
        }
    });
    test("User is deleted", async () => {
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
            user_creation_utc_date_time: '2023-07-31 17:18:47',

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
            user_creation_utc_date_time: '2023-07-31 17:18:47',
        }

        jest.spyOn(mockAuthRepository, "generateAccessToken").mockImplementation(() => { return "refreshed_token" })
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputUserData))
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(new Error("User cannot be used")))

        const loginUserUseCase = new RefreshToken(mockUserRepository, mockAuthRepository)
        try {
            const result = await loginUserUseCase.execute(InputUserData);
            expect(result).toBe(true);
        } catch (err) {
            expect(err.message).toBe("User cannot be used");
        }
    });
})
