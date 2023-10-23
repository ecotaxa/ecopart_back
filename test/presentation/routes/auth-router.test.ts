import request from "supertest";
import 'dotenv/config'

import server from '../../../src/server'
import AuthRouter from '../../../src/presentation/routers/auth-router'

import { AuthJwtRefreshedResponseModel, AuthJwtResponseModel, AuthUserCredentialsModel } from "../../../src/domain/entities/auth";
import { UserResponseModel } from "../../../src/domain/entities/user";

import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { LoginUserUseCase } from "../../../src/domain/interfaces/use-cases/auth/login";
import { RefreshTokenUseCase } from '../../../src/domain/interfaces/use-cases/auth/refreshToken'

import { MiddlewareAuthCookie } from "../../../src/presentation/middleware/auth_cookie";
import { JwtAdapter } from "../../../src/infra/auth/jsonwebtoken";

// class MockMiddlewareAuth implements MiddlewareAuth {
//     auth(_: Request, __: Response, next: NextFunction): void {
//         next()
//     }
//     auth_refresh(_: Request, __: Response, next: NextFunction): void {
//         next()
//     }
// }

class MockLoginUserUseCase implements LoginUserUseCase {
    execute(): Promise<(UserResponseModel & AuthJwtResponseModel) | null> {
        throw new Error("Method not implemented.")
    }
}
class MockRefreshTokenUseCase implements RefreshTokenUseCase {
    execute(): Promise<AuthJwtRefreshedResponseModel | null> {
        throw new Error("Method not implemented.")
    }
}

describe("User Router", () => {
    // let mockMiddlewareAuth: MockMiddlewareAuth;
    let mockMiddlewareAuth: MiddlewareAuth;
    let mockLoginUserUseCase: LoginUserUseCase;
    let mockRefreshTokenUseCase: MockRefreshTokenUseCase;
    let mockJwtAdapter: JwtAdapter;

    const TEST_ACCESS_TOKEN_SECRET = process.env.TEST_ACCESS_TOKEN_SECRET || ''
    const TEST_REFRESH_TOKEN_SECRET = process.env.TEST_REFRESH_TOKEN_SECRET || ''

    beforeAll(() => {
        //mockMiddlewareAuth = new MockMiddlewareAuth()
        mockJwtAdapter = new JwtAdapter()
        mockMiddlewareAuth = new MiddlewareAuthCookie(mockJwtAdapter, TEST_ACCESS_TOKEN_SECRET, TEST_REFRESH_TOKEN_SECRET);
        mockLoginUserUseCase = new MockLoginUserUseCase()
        mockRefreshTokenUseCase = new MockRefreshTokenUseCase
        server.use("/auth", AuthRouter(mockMiddlewareAuth, mockLoginUserUseCase, mockRefreshTokenUseCase))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })


    describe("Test user login", () => {
        test("login with valid credentials ", async () => {
            const InputData: AuthUserCredentialsModel = {
                email: "john@gmail.com",
                password: "test123!"
            }
            const OutputData: UserResponseModel & AuthJwtResponseModel = {
                id: 1,
                first_name: "John",
                last_name: "Smith",
                email: "john@gmail.com",
                is_admin: false,
                status: "Pending",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Mon usage",
                user_creation_date: "2023-07-31 17:18:47",
                jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJmaXJzdE5hbWUiOiJKb2huIiwibGFzdE5hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwib3JnYW5pc2F0aW9uIjoiTE9WIiwiY291bnRyeSI6IkZyYW5jZSIsInVzZXJfcGxhbm5lZF91c2FnZSI6Ik1vbiB1c2FnZSIsInVzZXJfY3JlYXRpb25fZGF0ZSI6IjIwMjMtMDctMzEgMTc6MTg6NDcifSwiaWF0IjoxNjkyMjAwNzUwLCJleHAiOjE2OTIyMDI1NTB9.L8JQUooDtZinbbYYHMgPPbmMt_kc4zicELzr5gbxZzI",
                jwt_refresh: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJmaXJzdE5hbWUiOiJKb2huIiwibGFzdE5hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwib3JnYW5pc2F0aW9uIjoiTE9WIiwiY291bnRyeSI6IkZyYW5jZSIsInVzZXJfcGxhbm5lZF91c2FnZSI6Ik1vbiB1c2FnZSIsInVzZXJfY3JlYXRpb25fZGF0ZSI6IjIwMjMtMDctMzEgMTc6MTg6NDcifSwiaWF0IjoxNjkyMjAwNzUwLCJleHAiOjE3MjM3NTgzNTB9.sqkt9gfeAAV6YT7J-vuKL7wb0Xh9wtVqyrJocJAhpqc"
            }
            jest.spyOn(mockLoginUserUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).post("/auth/login").send(InputData)
            expect(response.status).toBe(200)
            expect(mockLoginUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(OutputData)
            expect(response.headers['set-cookie']).toBeDefined(); // Check if cookies are set
        });

        test("login with invalid credentials ", async () => {
            const InputData: AuthUserCredentialsModel = {
                email: "john@gmail.com",
                password: "test123"
            }
            const expectedResponse = { errors: ["Invalid credentials"] }
            jest.spyOn(mockLoginUserUseCase, "execute").mockImplementation(() => Promise.resolve(null))
            const response = await request(server).post("/auth/login").send(InputData)
            expect(response.status).toBe(401)
            expect(mockLoginUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
            expect(response.headers['set-cookie']).toBeUndefined(); // Ensure no cookies are set
        });
    })

    // /users/me

    describe("Test /users/me endpoint", () => {
        test("get user information with valid token", async () => {
            const valid_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZmlyc3RfbmFtZSI6IkpvaG4iLCJsYXN0X25hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwiaXNfYWRtaW4iOjAsIm9yZ2FuaXNhdGlvbiI6IkxPViIsImNvdW50cnkiOiJGcmFuY2UiLCJ1c2VyX3BsYW5uZWRfdXNhZ2UiOiJNb24gdXNhZ2UiLCJ1c2VyX2NyZWF0aW9uX2RhdGUiOiIyMDIzLTEwLTIzIDE0OjA1OjU0IiwiaWF0IjoxNjk4MDY5OTY1LCJleHAiOjU4NTAxNzQ5OTY1fQ.vVcMomZhko94IOYorhGEu_B9f6oIFomeLAyAfNhMDWc"
            const expectedDecodedAccessToken = {
                "id": 1,
                "first_name": "John",
                "last_name": "Smith",
                "email": "john@gmail.com",
                "is_admin": "false",
                "status": "Pending",
                "organisation": "LOV",
                "country": "France",
                "user_planned_usage": "Mon usage",
                "user_creation_date": "2023-10-23 14:05:54",
                "exp": 58501749965,
                "iat": 1698069965
            }
            const response = await request(server)
                .get("/auth/user/me")
                .set("Cookie", `access_token=${valid_token}; Path=/; HttpOnly;`);

            expect(response.status).toBe(200);
            expect(response.body).toStrictEqual(expectedDecodedAccessToken);
        });

        test("get user information with missing token", async () => {
            const response = await request(server)
                .get("/auth/user/me")
                .expect(401);
            expect(response.body).toStrictEqual({
                "errors": [
                    "Token missing. Please authenticate."
                ]
            });
        });
    });

    //refreshToken
    describe("Test /auth/refreshToken endpoint", () => {
        test("should refresh token and return a new token", async () => {
            const valid_refresh_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJmaXJzdE5hbWUiOiJKb2huIiwibGFzdE5hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwib3JnYW5pc2F0aW9uIjoiTE9WIiwiY291bnRyeSI6IkZyYW5jZSIsInVzZXJfcGxhbm5lZF91c2FnZSI6Ik1vbiB1c2FnZSIsInVzZXJfY3JlYXRpb25fZGF0ZSI6IjIwMjMtMDctMzEgMTc6MTg6NDcifSwiaWF0IjoxNjkzMjE1NjM5LCJleHAiOjQ4NDg5NzU2Mzl9.XZxrf3_f6xsl0LG9U9huC7AnDZsVZsiiVUT9WzDvACs"
            const OutputData = {
                jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7fSwiaWF0IjoxNjkzMjE1Njk2LCJleHAiOjE2OTMyMTc0OTZ9.aofgJ6Mu1hWbUDM1dBm2oVj1R9JV8NU0FFFyslbMV_o"

            }
            jest.spyOn(mockRefreshTokenUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server)
                .post("/auth/refreshToken")
                .set("Cookie", `refresh_token=${valid_refresh_token}; Path=/; HttpOnly;`);

            expect(response.status).toBe(200)
            expect(mockRefreshTokenUseCase.execute).toBeCalledTimes(1);
            expect(response.body).toStrictEqual(OutputData)
            expect(response.headers['set-cookie']).toBeDefined();
        });
        test("should handle invalid refresh token and return a 401 response", async () => {
            const valid_refresh_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJmaXJzdE5hbWUiOiJKb2huIiwibGFzdE5hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwib3JnYW5pc2F0aW9uIjoiTE9WIiwiY291bnRyeSI6IkZyYW5jZSIsInVzZXJfcGxhbm5lZF91c2FnZSI6Ik1vbiB1c2FnZSIsInVzZXJfY3JlYXRpb25fZGF0ZSI6IjIwMjMtMDctMzEgMTc6MTg6NDcifSwiaWF0IjoxNjkzMjE1NjM5LCJleHAiOjQ4NDg5NzU2Mzl9.XZxrf3_f6xsl0LG9U9huC7AnDZsVZsiiVUT9WzDvACs"
            const expectedResponse = { errors: ["Invalid credentials"] }

            jest.spyOn(mockRefreshTokenUseCase, "execute").mockImplementation(() => Promise.resolve(null))
            const response = await request(server)
                .post("/auth/refreshToken")
                .set("Cookie", `refresh_token=${valid_refresh_token}; Path=/; HttpOnly;`);

            expect(response.status).toBe(401)
            expect(mockRefreshTokenUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
            expect(response.headers['set-cookie']).toBeUndefined();
        });
    })
    // logout
    describe("Test /auth/logout endpoint", () => {
        test("testing logout endpoint", async () => {

            const response = await request(server).post("/auth/logout").send();

            expect(response.status).toBe(200)
            expect(response.body).toEqual({ response: "You are Logged Out" });
            expect(response.header['set-cookie']).toEqual([
                'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
                'refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
            ]);
        });

    })
})