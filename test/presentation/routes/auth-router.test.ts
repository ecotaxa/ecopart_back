import request from "supertest";
import 'dotenv/config'

import server from '../../../src/server'
import AuthRouter from '../../../src/presentation/routers/auth-router'

import { AuthJwtRefreshedResponseModel, AuthJwtResponseModel, AuthUserCredentialsModel, ResetCredentialsModel } from "../../../src/domain/entities/auth";
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
    rulesResetPassword = [];
    rulesRequestResetPassword = [];
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
            const expectedResponse = { errors: ["Cannot login"] }

            jest.spyOn(mockLoginUserUseCase, "execute").mockImplementation(() => { throw new Error(); })

            const response = await request(server).post("/auth/login").send(InputData)

            expect(response.status).toBe(500)
            expect(mockLoginUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
            expect(response.headers['set-cookie']).toBeUndefined(); // Ensure no cookies are set
        });

        test("Login but user is deleted", async () => {
            const InputData: AuthUserCredentialsModel = {
                email: "john@gmail.com",
                password: "test123"
            }
            const expectedResponse = { errors: ["User cannot be used"] }

            jest.spyOn(mockLoginUserUseCase, "execute").mockImplementation(() => { throw new Error("User cannot be used"); })

            const response = await request(server).post("/auth/login").send(InputData)

            expect(response.status).toBe(403)
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
            // Cannot refresh token
            const invalid_refresh_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJmaXJzdE5hbWUiOiJKb2huIiwibGFzdE5hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwib3JnYW5pc2F0aW9uIjoiTE9WIiwiY291bnRyeSI6IkZyYW5jZSIsInVzZXJfcGxhbm5lZF91c2FnZSI6Ik1vbiB1c2FnZSIsInVzZXJfY3JlYXRpb25fZGF0ZSI6IjIwMjMtMDctMzEgMTc6MTg6NDcifSwiaWF0IjoxNjkzMjE1NjM5LCJleHAiOjQ4NDg5NzU2Mzl9.XZxrf3_f6xsl0LG9U9huC7AnDZsVZsiiVUT9WzDvACs"
            const expectedResponse = { errors: ["Cannot find user"] }

            jest.spyOn(mockRefreshTokenUseCase, "execute").mockImplementation(() => { throw new Error("Cannot find user"); })

            const response = await request(server)
                .post("/auth/refreshToken")
                .set("Cookie", `refresh_token=${invalid_refresh_token}; Path=/; HttpOnly;`);

            expect(response.body).toStrictEqual(expectedResponse)
            expect(response.status).toBe(404)
            expect(mockRefreshTokenUseCase.execute).toBeCalledTimes(1)
            expect(response.headers['set-cookie']).toBeUndefined();
        });

        test("Refresh token but user is deleted", async () => {
            const valid_refresh_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJmaXJzdE5hbWUiOiJKb2huIiwibGFzdE5hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwib3JnYW5pc2F0aW9uIjoiTE9WIiwiY291bnRyeSI6IkZyYW5jZSIsInVzZXJfcGxhbm5lZF91c2FnZSI6Ik1vbiB1c2FnZSIsInVzZXJfY3JlYXRpb25fZGF0ZSI6IjIwMjMtMDctMzEgMTc6MTg6NDcifSwiaWF0IjoxNjkzMjE1NjM5LCJleHAiOjQ4NDg5NzU2Mzl9.XZxrf3_f6xsl0LG9U9huC7AnDZsVZsiiVUT9WzDvACs"
            const expectedResponse = { errors: ["User cannot be used"] }

            jest.spyOn(mockRefreshTokenUseCase, "execute").mockImplementation(() => { throw new Error("User cannot be used"); })

            const response = await request(server)
                .post("/auth/refreshToken")
                .set("Cookie", `refresh_token=${valid_refresh_token}; Path=/; HttpOnly;`);

            expect(response.status).toBe(403)
            expect(mockRefreshTokenUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
            expect(response.headers['set-cookie']).toBeUndefined(); // Ensure no cookies are set
        });


        test("Should handle error during refresh token use case and return a 404 response", async () => {
            // Cannot refresh token
            const invalid_refresh_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJmaXJzdE5hbWUiOiJKb2huIiwibGFzdE5hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwib3JnYW5pc2F0aW9uIjoiTE9WIiwiY291bnRyeSI6IkZyYW5jZSIsInVzZXJfcGxhbm5lZF91c2FnZSI6Ik1vbiB1c2FnZSIsInVzZXJfY3JlYXRpb25fZGF0ZSI6IjIwMjMtMDctMzEgMTc6MTg6NDcifSwiaWF0IjoxNjkzMjE1NjM5LCJleHAiOjQ4NDg5NzU2Mzl9.XZxrf3_f6xsl0LG9U9huC7AnDZsVZsiiVUT9WzDvACs"
            const expectedResponse = { errors: ["Cannot refresh token"] }

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
            expect(response.body).toEqual({ message: "You are Logged Out" });
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

            const expectedResponse = { message: "Password sucessfully changed" }

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

        test("should return error id user is deleted", async () => {
            const valid_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZmlyc3RfbmFtZSI6IkpvaG4iLCJsYXN0X25hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwiaXNfYWRtaW4iOmZhbHNlLCJvcmdhbmlzYXRpb24iOiJMT1YiLCJjb3VudHJ5IjoiRnJhbmNlIiwidXNlcl9wbGFubmVkX3VzYWdlIjoiTW9uIHVzYWdlIiwidXNlcl9jcmVhdGlvbl9kYXRlIjoiMjAyMy0xMC0yNiAxMjo1NzoyNyIsImlhdCI6MTY5ODMyNTI3NSwiZXhwIjo1ODUwMjAwNTI3NX0.LkhqGRdUJ8X5X0ZnqU4HeRIANFj84bk-jtQlSo_dXz8"

            const credentials = {
                user_id: 1,
                password: "test123!",
                new_password: "test123!!"
            }

            const expectedResponse = { errors: ["User cannot be used"] }

            jest.spyOn(mockChangePasswordUseCase, "execute").mockImplementation(() => { throw new Error("User cannot be used"); })

            const response = await request(server)
                .post("/auth/password/change")
                .set("Cookie", `access_token=${valid_token}; Path=/; HttpOnly;`)
                .send(credentials);

            expect(response.status).toBe(403)
            expect(response.body).toStrictEqual(expectedResponse);
        });

        test("Should handle error during Change password use case and return a 500 response", async () => {
            const valid_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZmlyc3RfbmFtZSI6IkpvaG4iLCJsYXN0X25hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwiaXNfYWRtaW4iOmZhbHNlLCJvcmdhbmlzYXRpb24iOiJMT1YiLCJjb3VudHJ5IjoiRnJhbmNlIiwidXNlcl9wbGFubmVkX3VzYWdlIjoiTW9uIHVzYWdlIiwidXNlcl9jcmVhdGlvbl9kYXRlIjoiMjAyMy0xMC0yNiAxMjo1NzoyNyIsImlhdCI6MTY5ODMyNTI3NSwiZXhwIjo1ODUwMjAwNTI3NX0.LkhqGRdUJ8X5X0ZnqU4HeRIANFj84bk-jtQlSo_dXz8"

            const credentials = {
                user_id: 1,
                password: "test123!",
                new_password: "test123!!"
            }

            const expectedResponse = { errors: ["Cannot change password"] }

            jest.spyOn(mockChangePasswordUseCase, "execute").mockImplementation(() => { throw new Error("Cannot find user"); })

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

    // reset password request
    describe("Test POST /auth/password/reset endpoint", () => {
        test("Should send email", async () => {
            const InputData = {
                "email": "john@gmail.com",
            }

            const expectedResponse = { message: "Reset password request email sent." }

            jest.spyOn(mockResetPasswordRequestUseCase, "execute").mockImplementation(() => Promise.resolve())

            const response = await request(server).post("/auth/password/reset").send(InputData)

            expect(response.status).toBe(200)
            expect(mockResetPasswordRequestUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("Should handle error seamlessly if user already exist and return 200", async () => {
            const InputData = {
                "email": "john@gmail.com",
            }

            const expectedResponse = { message: "Reset password request email sent." }

            jest.spyOn(mockResetPasswordRequestUseCase, "execute").mockImplementation(() => Promise.reject(new Error("User does not exist")))

            const response = await request(server).post("/auth/password/reset").send(InputData)

            expect(response.status).toBe(200)
            expect(mockResetPasswordRequestUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("should return error if user is deleted", async () => {
            const InputData = {
                "email": "john@gmail.com",
            }

            const expectedResponse = { errors: ["Cannot reset password"] }
            jest.spyOn(mockResetPasswordRequestUseCase, "execute").mockImplementation(() => Promise.reject(new Error("User cannot be used")))

            const response = await request(server).post("/auth/password/reset").send(InputData)

            expect(response.status).toBe(403)
            expect(mockResetPasswordRequestUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });


        test("Should handle error seamlessly if user account not validated and return 200", async () => {
            const InputData = {
                "email": "john@gmail.com",
            }

            const expectedResponse = { message: "Reset password request email sent." }

            jest.spyOn(mockResetPasswordRequestUseCase, "execute").mockImplementation(() => Promise.reject(new Error("User email is not validated")))

            const response = await request(server).post("/auth/password/reset").send(InputData)

            expect(response.status).toBe(200)
            expect(mockResetPasswordRequestUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("Cannot find updated user", async () => {
            const InputData = {
                "email": "john@gmail.com",
            }
            const expectedResponse = { errors: ["Cannot reset password"] }

            jest.spyOn(mockResetPasswordRequestUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot find updated user")))

            const response = await request(server).post("/auth/password/reset").send(InputData)

            expect(response.status).toBe(500)
            expect(mockResetPasswordRequestUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("Should handle internal errors and handle it explicitely and return a 500 response", async () => {
            const InputData = {
                "email": "john@gmail.com",
            }

            const expectedResponse = { errors: ["Cannot reset password"] }

            // Cannot set password reset code
            jest.spyOn(mockResetPasswordRequestUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot set password reset code")))
            const response = await request(server).post("/auth/password/reset").send(InputData)
            expect(response.status).toBe(500)
            expect(mockResetPasswordRequestUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)

            //cannot find updated user
            jest.spyOn(mockResetPasswordRequestUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot set password reset code")))
            const response_2 = await request(server).post("/auth/password/reset").send(InputData)
            expect(response_2.status).toBe(500)
            expect(mockResetPasswordRequestUseCase.execute).toBeCalledTimes(2)
            expect(response_2.body).toStrictEqual(expectedResponse)

            // cannot reset password
            jest.spyOn(mockResetPasswordRequestUseCase, "execute").mockImplementation(() => Promise.reject(new Error()))
            const response_3 = await request(server).post("/auth/password/reset").send(InputData)
            expect(response_3.status).toBe(500)
            expect(mockResetPasswordRequestUseCase.execute).toBeCalledTimes(3)
            expect(response_3.body).toStrictEqual(expectedResponse)


        });
    })
    // reset password 
    describe("Test PUT /auth/password/reset endpoint", () => {
        test("Should update password", async () => {
            const InputData: ResetCredentialsModel = {
                new_password: "test123!",
                reset_password_token: "reset_password_token",
            }
            const expectedResponse = { message: "Password sucessfully reset, please login" }

            jest.spyOn(mockResetPasswordUseCase, "execute").mockImplementation(() => Promise.resolve())

            const response = await request(server).put("/auth/password/reset").send(InputData)

            expect(response.status).toBe(200)
            expect(response.body).toStrictEqual(expectedResponse)
            expect(mockResetPasswordUseCase.execute).toBeCalledTimes(1)
        });

        test("Should handle error if Token is not valid and return 401", async () => {
            const InputData: ResetCredentialsModel = {
                new_password: "test123!!!!!!!",
                reset_password_token: "BAD_reset_password_token",
            }
            const error_message = "Token is not valid"
            const expectedResponse = { errors: ["Cannot reset password"] }

            jest.spyOn(mockResetPasswordUseCase, "execute").mockImplementation(() => Promise.reject(new Error(error_message)))

            const response = await request(server).put("/auth/password/reset").send(InputData)

            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
            expect(mockResetPasswordUseCase.execute).toBeCalledTimes(1)
        });


        test("Should handle error if Token is not valid and return 401", async () => {
            const InputData: ResetCredentialsModel = {
                new_password: "test123!!!!!!!",
                reset_password_token: "BAD_reset_password_token",
            }
            const error_message = "Token is not valid"
            const expectedResponse = { errors: ["Cannot reset password"] }

            jest.spyOn(mockResetPasswordUseCase, "execute").mockImplementation(() => Promise.reject(new Error(error_message)))

            const response = await request(server).put("/auth/password/reset").send(InputData)

            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
            expect(mockResetPasswordUseCase.execute).toBeCalledTimes(1)
        });

        test("Should handle error if user is deleted", async () => {
            const InputData: ResetCredentialsModel = {
                new_password: "test123!!!!!!!",
                reset_password_token: "reset_password_token",
            }
            const error_message = "User cannot be used"
            const expectedResponse = {
                errors: ["Cannot reset password"]
            }

            jest.spyOn(mockResetPasswordUseCase, "execute").mockImplementation(() => Promise.reject(new Error(error_message)))

            const response = await request(server).put("/auth/password/reset").send(InputData)

            expect(response.status).toBe(403)
            expect(response.body).toStrictEqual(expectedResponse)
            expect(mockResetPasswordUseCase.execute).toBeCalledTimes(1)
        });

        test("Should handle error if Token is missing and return 401", async () => {
            const InputData: ResetCredentialsModel = {
                new_password: "test123!!!!!!!",
                reset_password_token: null,
            }
            const error_message = "No token provided"
            const expectedResponse = { errors: ["Cannot reset password"] }

            jest.spyOn(mockResetPasswordUseCase, "execute").mockImplementation(() => Promise.reject(new Error(error_message)))

            const response = await request(server).put("/auth/password/reset").send(InputData)

            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
            expect(mockResetPasswordUseCase.execute).toBeCalledTimes(1)
        });

        test("Should handle error if ser does not exist or token is not valid and return 404", async () => {
            const InputData: ResetCredentialsModel = {
                new_password: "test123!!!!!!!",
                reset_password_token: "reset_password_token",
            }
            const error_message = "User does not exist or reset_password_code is not valid"
            const expectedResponse = { errors: ["Cannot reset password"] }

            jest.spyOn(mockResetPasswordUseCase, "execute").mockImplementation(() => Promise.reject(new Error(error_message)))

            const response = await request(server).put("/auth/password/reset").send(InputData)

            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
            expect(mockResetPasswordUseCase.execute).toBeCalledTimes(1)
        });

        test("Should handle error if User email is not validated and return 403", async () => {
            const InputData: ResetCredentialsModel = {
                new_password: "test123!!!!!!!",
                reset_password_token: "reset_password_token",
            }
            const error_message = "User email is not validated"
            const expectedResponse = { errors: ["Cannot reset password"] }

            jest.spyOn(mockResetPasswordUseCase, "execute").mockImplementation(() => Promise.reject(new Error(error_message)))

            const response = await request(server).put("/auth/password/reset").send(InputData)

            expect(response.status).toBe(403)
            expect(response.body).toStrictEqual(expectedResponse)
            expect(mockResetPasswordUseCase.execute).toBeCalledTimes(1)
        });

        test("Should handle any other error and return 500", async () => {
            const InputData: ResetCredentialsModel = {
                new_password: "test123!!!!!!!",
                reset_password_token: "reset_password_token",
            }
            const expectedResponse = { errors: ["Cannot reset password"] }

            jest.spyOn(mockResetPasswordUseCase, "execute").mockImplementation(() => Promise.reject(new Error()))

            const response = await request(server).put("/auth/password/reset").send(InputData)

            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
            expect(mockResetPasswordUseCase.execute).toBeCalledTimes(1)
        });

    })
})