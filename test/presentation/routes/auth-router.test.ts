import request from "supertest";
import 'dotenv/config'

import server from '../../../src/server'
import AuthRouter from '../../../src/presentation/routers/auth-router'

import { AuthJwtRefreshedResponseModel, AuthJwtResponseModel, AuthUserCredentialsModel } from "../../../src/domain/entities/auth";
import { UserResponseModel } from "../../../src/domain/entities/user";

import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { LoginUserUseCase } from "../../../src/domain/interfaces/use-cases/auth/login";
import { RefreshTokenUseCase } from '../../../src/domain/interfaces/use-cases/auth/refresh-token'
import { ChangePasswordUseCase } from "../../../src/domain/interfaces/use-cases/auth/change-password";
import { ResetPasswordRequestUseCase } from "../../../src/domain/interfaces/use-cases/auth/reset-password-request";
import { ResetPasswordUseCase } from "../../../src/domain/interfaces/use-cases/auth/reset-password";

import { MiddlewareAuthCookie } from "../../../src/presentation/middleware/auth-cookie";
import { JwtAdapter } from "../../../src/infra/auth/jsonwebtoken";
import { IMiddlewareAuthValidation } from "../../../src/presentation/interfaces/middleware/auth-validation";


class MockLoginUserUseCase implements LoginUserUseCase {
    execute(): Promise<(UserResponseModel & AuthJwtResponseModel)> {
        throw new Error("Method not implemented.")
    }
}
class MockRefreshTokenUseCase implements RefreshTokenUseCase {
    execute(): Promise<AuthJwtRefreshedResponseModel> {
        throw new Error("Method not implemented.")
    }
}
class MockMiddlewareAuthValidation implements IMiddlewareAuthValidation {
    rulesRequestResetPassword: [];
    rulesPassword = []
    rulesAuthUserCredentialsModel = [];
}
class MockChangePasswordUseCase implements ChangePasswordUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented.")
    }
}
class MockResetPasswordRequestUseCase implements ResetPasswordRequestUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented.")
    }
}
class MockResetPasswordUseCase implements ResetPasswordUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented.")
    }
}
describe("User Router", () => {
    // let mockMiddlewareAuth: MockMiddlewareAuth;
    let mockMiddlewareAuth: MiddlewareAuth;
    let mockLoginUserUseCase: LoginUserUseCase;
    let mockRefreshTokenUseCase: MockRefreshTokenUseCase;
    let mockChangePasswordUseCase: MockChangePasswordUseCase;
    let mockJwtAdapter: JwtAdapter;
    let mockMiddlewareAuthValidation: MockMiddlewareAuthValidation;
    let mockResetPasswordRequestUseCase: MockResetPasswordRequestUseCase;
    let mockResetPasswordUseCase: MockResetPasswordUseCase;


    const TEST_ACCESS_TOKEN_SECRET = process.env.TEST_ACCESS_TOKEN_SECRET || ''
    const TEST_REFRESH_TOKEN_SECRET = process.env.TEST_REFRESH_TOKEN_SECRET || ''

    beforeAll(() => {
        //mockMiddlewareAuth = new MockMiddlewareAuth()
        mockJwtAdapter = new JwtAdapter()
        mockMiddlewareAuth = new MiddlewareAuthCookie(mockJwtAdapter, TEST_ACCESS_TOKEN_SECRET, TEST_REFRESH_TOKEN_SECRET);
        mockMiddlewareAuthValidation = new MockMiddlewareAuthValidation()
        mockLoginUserUseCase = new MockLoginUserUseCase()
        mockRefreshTokenUseCase = new MockRefreshTokenUseCase()
        mockChangePasswordUseCase = new MockChangePasswordUseCase()
        mockResetPasswordRequestUseCase = new MockResetPasswordRequestUseCase()
        mockResetPasswordUseCase = new MockResetPasswordUseCase()

        server.use("/auth", AuthRouter(mockMiddlewareAuth, mockMiddlewareAuthValidation, mockLoginUserUseCase, mockRefreshTokenUseCase, mockChangePasswordUseCase, mockResetPasswordRequestUseCase, mockResetPasswordUseCase))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })


    describe("Test user login", () => {
        test("Login with valid credentials ", async () => {
            const InputData: AuthUserCredentialsModel = {
                email: "john@gmail.com",
                password: "test123!"
            }
            const OutputData: UserResponseModel & AuthJwtResponseModel = {
                user_id: 1,
                first_name: "John",
                last_name: "Smith",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
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

        test("Login with invalid credentials ", async () => {
            const InputData: AuthUserCredentialsModel = {
                email: "john@gmail.com",
                password: "test123"
            }
            const expectedResponse = { errors: ["Invalid credentials"] }

            jest.spyOn(mockLoginUserUseCase, "execute").mockImplementation(() => { throw new Error("Invalid credentials"); })

            const response = await request(server).post("/auth/login").send(InputData)

            expect(response.status).toBe(401)
            expect(mockLoginUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
            expect(response.headers['set-cookie']).toBeUndefined(); // Ensure no cookies are set
        });

        test("Login with unvalidated account ", async () => {
            const InputData: AuthUserCredentialsModel = {
                email: "john@gmail.com",
                password: "test123"
            }
            const expectedResponse = { errors: ["User email not verified"] }

            jest.spyOn(mockLoginUserUseCase, "execute").mockImplementation(() => { throw new Error("User email not verified"); })

            const response = await request(server).post("/auth/login").send(InputData)

            expect(response.status).toBe(403)
            expect(mockLoginUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
            expect(response.headers['set-cookie']).toBeUndefined(); // Ensure no cookies are set
        });

        test("Login fail for unexepted reason", async () => {
            const InputData: AuthUserCredentialsModel = {
                email: "john@gmail.com",
                password: "test123"
            }
            const expectedResponse = { errors: ["Can't login"] }

            jest.spyOn(mockLoginUserUseCase, "execute").mockImplementation(() => { throw new Error(); })

            const response = await request(server).post("/auth/login").send(InputData)

            expect(response.status).toBe(500)
            expect(mockLoginUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
            expect(response.headers['set-cookie']).toBeUndefined(); // Ensure no cookies are set
        });
    })

    // /users/me
    describe("Test /users/me endpoint", () => {
        test("Get user information with valid token", async () => {
            const valid_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZmlyc3RfbmFtZSI6IkpvaG4iLCJsYXN0X25hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwiaXNfYWRtaW4iOmZhbHNlLCJvcmdhbmlzYXRpb24iOiJMT1YiLCJjb3VudHJ5IjoiRnJhbmNlIiwidXNlcl9wbGFubmVkX3VzYWdlIjoiTW9uIHVzYWdlIiwidXNlcl9jcmVhdGlvbl9kYXRlIjoiMjAyMy0xMC0yNiAxMjo1NzoyNyIsImlhdCI6MTY5ODMyNTI3NSwiZXhwIjo1ODUwMjAwNTI3NX0.LkhqGRdUJ8X5X0ZnqU4HeRIANFj84bk-jtQlSo_dXz8"
            const expectedDecodedAccessToken = {
                "id": 1,
                "first_name": "John",
                "last_name": "Smith",
                "email": "john@gmail.com",
                "is_admin": false,
                "status": "Pending",
                "organisation": "LOV",
                "country": "France",
                "user_planned_usage": "Mon usage",
                "user_creation_date": "2023-10-26 12:57:27",
                "exp": 58502005275,
                "iat": 1698325275
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
        test("Should refresh token and return a new token", async () => {
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

        test("Should handle error during refresh token use case and return a 404 response", async () => {
            // Can't refresh token
            const invalid_refresh_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJmaXJzdE5hbWUiOiJKb2huIiwibGFzdE5hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwib3JnYW5pc2F0aW9uIjoiTE9WIiwiY291bnRyeSI6IkZyYW5jZSIsInVzZXJfcGxhbm5lZF91c2FnZSI6Ik1vbiB1c2FnZSIsInVzZXJfY3JlYXRpb25fZGF0ZSI6IjIwMjMtMDctMzEgMTc6MTg6NDcifSwiaWF0IjoxNjkzMjE1NjM5LCJleHAiOjQ4NDg5NzU2Mzl9.XZxrf3_f6xsl0LG9U9huC7AnDZsVZsiiVUT9WzDvACs"
            const expectedResponse = { errors: ["Can't find user"] }

            jest.spyOn(mockRefreshTokenUseCase, "execute").mockImplementation(() => { throw new Error("Can't find user"); })

            const response = await request(server)
                .post("/auth/refreshToken")
                .set("Cookie", `refresh_token=${invalid_refresh_token}; Path=/; HttpOnly;`);

            expect(response.body).toStrictEqual(expectedResponse)
            expect(response.status).toBe(404)
            expect(mockRefreshTokenUseCase.execute).toBeCalledTimes(1)
            expect(response.headers['set-cookie']).toBeUndefined();
        });

        test("Should handle error during refresh token use case and return a 404 response", async () => {
            // Can't refresh token
            const invalid_refresh_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJmaXJzdE5hbWUiOiJKb2huIiwibGFzdE5hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwib3JnYW5pc2F0aW9uIjoiTE9WIiwiY291bnRyeSI6IkZyYW5jZSIsInVzZXJfcGxhbm5lZF91c2FnZSI6Ik1vbiB1c2FnZSIsInVzZXJfY3JlYXRpb25fZGF0ZSI6IjIwMjMtMDctMzEgMTc6MTg6NDcifSwiaWF0IjoxNjkzMjE1NjM5LCJleHAiOjQ4NDg5NzU2Mzl9.XZxrf3_f6xsl0LG9U9huC7AnDZsVZsiiVUT9WzDvACs"
            const expectedResponse = { errors: ["Can't refresh token"] }

            jest.spyOn(mockRefreshTokenUseCase, "execute").mockImplementation(() => { throw new Error(); })

            const response = await request(server)
                .post("/auth/refreshToken")
                .set("Cookie", `refresh_token=${invalid_refresh_token}; Path=/; HttpOnly;`);

            expect(response.body).toStrictEqual(expectedResponse)
            expect(response.status).toBe(500)
            expect(mockRefreshTokenUseCase.execute).toBeCalledTimes(1)
            expect(response.headers['set-cookie']).toBeUndefined();
        });
    })
    // logout
    describe("Test /auth/logout endpoint", () => {
        test("Testing logout endpoint", async () => {

            const response = await request(server).post("/auth/logout").send();

            expect(response.status).toBe(200)
            expect(response.body).toEqual({ response: "You are Logged Out" });
            expect(response.header['set-cookie']).toEqual([
                'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
                'refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
            ]);
        });

    })

    // Change password
    describe("Test /auth/password/change endpoint", () => {
        test("Should change password with valid token", async () => {
            const valid_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZmlyc3RfbmFtZSI6IkpvaG4iLCJsYXN0X25hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwiaXNfYWRtaW4iOmZhbHNlLCJvcmdhbmlzYXRpb24iOiJMT1YiLCJjb3VudHJ5IjoiRnJhbmNlIiwidXNlcl9wbGFubmVkX3VzYWdlIjoiTW9uIHVzYWdlIiwidXNlcl9jcmVhdGlvbl9kYXRlIjoiMjAyMy0xMC0yNiAxMjo1NzoyNyIsImlhdCI6MTY5ODMyNTI3NSwiZXhwIjo1ODUwMjAwNTI3NX0.LkhqGRdUJ8X5X0ZnqU4HeRIANFj84bk-jtQlSo_dXz8"

            const credentials = {
                user_id: 1,
                password: "test123!",
                new_password: "test123!!"
            }

            const expectedResponse = { response: "Password sucessfully changed" }

            jest.spyOn(mockChangePasswordUseCase, "execute").mockImplementation(() => Promise.resolve())

            try {
                const response = await request(server)
                    .post("/auth/password/change")
                    .set("Cookie", `access_token=${valid_token}; Path=/; HttpOnly;`)
                    .send(credentials);
                expect(response.status).toBe(200);
                expect(response.body).toStrictEqual(expectedResponse);
            } catch (err) {
                console.log(err.message)
                expect(true).toBe(false)
            }
        });

        test("Should handle error during Change password use case and return a 500 response", async () => {
            const valid_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZmlyc3RfbmFtZSI6IkpvaG4iLCJsYXN0X25hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwiaXNfYWRtaW4iOmZhbHNlLCJvcmdhbmlzYXRpb24iOiJMT1YiLCJjb3VudHJ5IjoiRnJhbmNlIiwidXNlcl9wbGFubmVkX3VzYWdlIjoiTW9uIHVzYWdlIiwidXNlcl9jcmVhdGlvbl9kYXRlIjoiMjAyMy0xMC0yNiAxMjo1NzoyNyIsImlhdCI6MTY5ODMyNTI3NSwiZXhwIjo1ODUwMjAwNTI3NX0.LkhqGRdUJ8X5X0ZnqU4HeRIANFj84bk-jtQlSo_dXz8"

            const credentials = {
                user_id: 1,
                password: "test123!",
                new_password: "test123!!"
            }

            const expectedResponse = { errors: ["Can't change password"] }

            jest.spyOn(mockChangePasswordUseCase, "execute").mockImplementation(() => { throw new Error("Can't find user"); })

            const response = await request(server)
                .post("/auth/password/change")
                .set("Cookie", `access_token=${valid_token}; Path=/; HttpOnly;`)
                .send(credentials);

            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse);
        });

        test("Should handle error during Change password use case and return a 500 response", async () => {
            const valid_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZmlyc3RfbmFtZSI6IkpvaG4iLCJsYXN0X25hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwiaXNfYWRtaW4iOmZhbHNlLCJvcmdhbmlzYXRpb24iOiJMT1YiLCJjb3VudHJ5IjoiRnJhbmNlIiwidXNlcl9wbGFubmVkX3VzYWdlIjoiTW9uIHVzYWdlIiwidXNlcl9jcmVhdGlvbl9kYXRlIjoiMjAyMy0xMC0yNiAxMjo1NzoyNyIsImlhdCI6MTY5ODMyNTI3NSwiZXhwIjo1ODUwMjAwNTI3NX0.LkhqGRdUJ8X5X0ZnqU4HeRIANFj84bk-jtQlSo_dXz8"

            const credentials = {
                user_id: 1,
                password: "test123!",
                new_password: "test123!"
            }

            const expectedResponse = { errors: ["New password must be different from old password"] }

            jest.spyOn(mockChangePasswordUseCase, "execute").mockImplementation(() => { throw new Error("New password must be different from old password"); })

            const response = await request(server)
                .post("/auth/password/change")
                .set("Cookie", `access_token=${valid_token}; Path=/; HttpOnly;`)
                .send(credentials);

            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse);
        });
    })
})