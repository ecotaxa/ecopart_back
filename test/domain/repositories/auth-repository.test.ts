//test/domain/repositories/auth-repository.test.ts
import { JwtPayload } from "jsonwebtoken";
import { AuthRepository } from "../../../src/domain/interfaces/repositories/auth-repository";
import { AuthRepositoryImpl } from "../../../src/domain/repositories/auth-repository";
import { JwtAdapter } from "../../../src/infra/auth/jsonwebtoken";
import { UserSessionDataSource } from "../../../src/data/interfaces/data-sources/user-session-data-source";

// Token tests do not touch sessions; session behaviour is tested on a real database in auth-repository-sessions.test.ts
const noSessions = {} as UserSessionDataSource

class MockJwtAdapter extends JwtAdapter {
    sign(): string {
        throw new Error("Method not implemented for sign");
    }
    verify(): JwtPayload | string {
        throw new Error("Method not implemented for verify");
    }
}


const TEST_ACCESS_TOKEN_SECRET = process.env.TEST_ACCESS_TOKEN_SECRET || ''
const TEST_REFRESH_TOKEN_SECRET = process.env.TEST_REFRESH_TOKEN_SECRET || ''

describe("Auth Repository", () => {
    let authRepository: AuthRepository
    let jwt: JwtAdapter

    beforeEach(() => {
        jest.clearAllMocks();
        jwt = new MockJwtAdapter()
        authRepository = new AuthRepositoryImpl(jwt, TEST_ACCESS_TOKEN_SECRET, TEST_REFRESH_TOKEN_SECRET, noSessions)
    })

    describe("Test generateAccessToken", () => {
        test("Should return valid access token", async () => {
            const InputData = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00'
            }
            const expectedData = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZmlyc3ROYW1lIjoiSm9obiIsImxhc3ROYW1lIjoiU21pdGgiLCJlbWFpbCI6ImpvaG5AZ21haWwuY29tIiwic3RhdHVzIjoiUGVuZGluZyIsIm9yZ2FuaXNhdGlvbiI6IkxPViIsImNvdW50cnkiOiJGcmFuY2UiLCJ1c2VyX3BsYW5uZWRfdXNhZ2UiOiJNb24gdXNhZ2UiLCJ1c2VyX2NyZWF0aW9uX2RhdGUiOiIyMDIzLTA3LTMxIDE3OjE4OjQ3IiwiaWF0IjoxNjkzNDA2MDI3LCJleHAiOjE2OTM0MDc4Mjd9.pES4WXEsoN9QBo5OBoy3NmFW02OcvC8KyPT1E0zBRog"
            jest.spyOn(jwt, "sign").mockImplementation(() => { return expectedData })
            const result = authRepository.generateAccessToken(InputData);
            expect(result).toBe(expectedData)
        });
    })

    describe("Token payload and lifetime", () => {
        const UserWithPrivateFields = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "usage",
            user_creation_utc_date_time: '2023-08-01 10:30:00',
            confirmation_code: "confirm-uuid",
            reset_password_code: "reset-uuid",
            managing_projects: [1],
            member_projects: [2],
        }
        const ExpectedPayload = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "usage",
            user_creation_utc_date_time: '2023-08-01 10:30:00',
        }

        test("access token: one hour, without codes nor project lists", () => {
            jest.spyOn(jwt, "sign").mockImplementation(() => "token")
            authRepository.generateAccessToken(UserWithPrivateFields)
            expect(jwt.sign).toBeCalledWith(ExpectedPayload, TEST_ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
        });

        test("access token carries the session id when there is one", () => {
            jest.spyOn(jwt, "sign").mockImplementation(() => "token")
            authRepository.generateAccessToken(UserWithPrivateFields, "sid-1")
            expect(jwt.sign).toBeCalledWith({ ...ExpectedPayload, sid: "sid-1" }, TEST_ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
        });

        test("refresh token: thirty days, with its session id, without codes nor project lists", () => {
            jest.spyOn(jwt, "sign").mockImplementation(() => "token")
            authRepository.generateRefreshToken(UserWithPrivateFields, "sid-1")
            expect(jwt.sign).toBeCalledWith({ ...ExpectedPayload, sid: "sid-1" }, TEST_REFRESH_TOKEN_SECRET, { expiresIn: '30d' })
        });

        test("a real token verifies and expires one hour after issue", () => {
            const realRepository = new AuthRepositoryImpl(new JwtAdapter(), "secret_for_test", "refresh_for_test", noSessions)
            const token = realRepository.generateAccessToken(UserWithPrivateFields)
            const decoded = new JwtAdapter().verify(token, "secret_for_test") as JwtPayload
            expect((decoded.exp as number) - (decoded.iat as number)).toBe(3600)
            expect(decoded.reset_password_code).toBeUndefined()
            expect(decoded.confirmation_code).toBeUndefined()
        });

        test("a token signed with another algorithm is rejected", () => {
            const realJwt = new JwtAdapter()
            const hs512 = realJwt.sign({ user_id: 1 }, "secret_for_test", { algorithm: 'HS512' })
            expect(() => realJwt.verify(hs512, "secret_for_test")).toThrow("invalid algorithm")
        });
    })

    describe("Test generateRefreshToken", () => {
        test("Should return valid Refresh", async () => {
            const InputData = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00'
            }
            const expectedData = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZmlyc3ROYW1lIjoiSm9obiIsImxhc3ROYW1lIjoiU21pdGgiLCJlbWFpbCI6ImpvaG5AZ21haWwuY29tIiwic3RhdHVzIjoiUGVuZGluZyIsIm9yZ2FuaXNhdGlvbiI6IkxPViIsImNvdW50cnkiOiJGcmFuY2UiLCJ1c2VyX3BsYW5uZWRfdXNhZ2UiOiJNb24gdXNhZ2UiLCJ1c2VyX2NyZWF0aW9uX2RhdGUiOiIyMDIzLTA3LTMxIDE3OjE4OjQ3IiwiaWF0IjoxNjkzNDA2MDI3LCJleHAiOjE2OTM0MDc4Mjd9.pES4WXEsoN9QBo5OBoy3NmFW02OcvC8KyPT1E0zBRog"
            jest.spyOn(jwt, "sign").mockImplementation(() => { return expectedData })
            const result = authRepository.generateRefreshToken(InputData, "sid-1");
            expect(result).toBe(expectedData)
        });
    })
})