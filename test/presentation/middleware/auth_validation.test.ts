import request from "supertest";
import 'dotenv/config'

import server from '../../../src/server'
import AuthRouter from '../../../src/presentation/routers/auth-router'

import { AuthJwtRefreshedResponseModel, AuthJwtResponseModel, AuthUserCredentialsModel } from "../../../src/domain/entities/auth";
import { UserResponseModel } from "../../../src/domain/entities/user";

import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { LoginUserUseCase } from "../../../src/domain/interfaces/use-cases/auth/login";
import { RefreshTokenUseCase } from '../../../src/domain/interfaces/use-cases/auth/refresh-token';
import { ChangePasswordUseCase } from "../../../src/domain/interfaces/use-cases/auth/change-password";

import { MiddlewareAuthCookie } from "../../../src/presentation/middleware/auth_cookie";
import { JwtAdapter } from "../../../src/infra/auth/jsonwebtoken";
import { IMiddlewareAuthValidation } from "../../../src/presentation/interfaces/middleware/auth_validation";
import { MiddlewareAuthValidation } from "../../../src/presentation/middleware/auth_validation";

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

class MockChangePasswordUseCase implements ChangePasswordUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented.")
    }
}

describe("User Router", () => {
    // let mockMiddlewareAuth: MockMiddlewareAuth;
    let mockMiddlewareAuth: MiddlewareAuth;
    let mockLoginUserUseCase: LoginUserUseCase;
    let mockRefreshTokenUseCase: MockRefreshTokenUseCase;
    let mockJwtAdapter: JwtAdapter;
    let middlewareAuthValidation: IMiddlewareAuthValidation;
    let mockChangePasswordUseCase: ChangePasswordUseCase;

    const TEST_ACCESS_TOKEN_SECRET = process.env.TEST_ACCESS_TOKEN_SECRET || ''
    const TEST_REFRESH_TOKEN_SECRET = process.env.TEST_REFRESH_TOKEN_SECRET || ''

    beforeAll(() => {
        mockJwtAdapter = new JwtAdapter()
        mockMiddlewareAuth = new MiddlewareAuthCookie(mockJwtAdapter, TEST_ACCESS_TOKEN_SECRET, TEST_REFRESH_TOKEN_SECRET);
        middlewareAuthValidation = new MiddlewareAuthValidation()
        mockLoginUserUseCase = new MockLoginUserUseCase()
        mockRefreshTokenUseCase = new MockRefreshTokenUseCase()
        mockChangePasswordUseCase = new MockChangePasswordUseCase()

        server.use("/auth", AuthRouter(mockMiddlewareAuth, middlewareAuthValidation, mockLoginUserUseCase, mockRefreshTokenUseCase, mockChangePasswordUseCase))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })


    describe("Test auth router login validation", () => {
        test("Login valid eamil and password ", async () => {
            const InputData: AuthUserCredentialsModel = {
                email: "john@gmail.com",
                password: "Test123!"
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
        test("Login valid eamil and invalid password ", async () => {
            const InputData: AuthUserCredentialsModel = {
                email: "john@gmail.com",
                password: "psword"
            }
            const OutputData = { "errors": ["Invalid credentials"] }
            jest.spyOn(mockLoginUserUseCase, "execute").mockImplementation(() => { throw new Error() })

            const response = await request(server).post("/auth/login").send(InputData)

            expect(response.status).toBe(401)
            expect(mockLoginUserUseCase.execute).not.toBeCalled()
            expect(response.body).toStrictEqual(OutputData)
            expect(response.headers['set-cookie']).not.toBeDefined(); // Check if cookies are set
        });
        test("Login invalid eamil and valid password ", async () => {
            const InputData: AuthUserCredentialsModel = {
                email: "john@gmailcom",
                password: "Psword123!"
            }
            const OutputData = { "errors": ["Invalid credentials"] }
            jest.spyOn(mockLoginUserUseCase, "execute").mockImplementation(() => { throw new Error() })

            const response = await request(server).post("/auth/login").send(InputData)

            expect(response.status).toBe(401)
            expect(mockLoginUserUseCase.execute).not.toBeCalled()
            expect(response.body).toStrictEqual(OutputData)
            expect(response.headers['set-cookie']).not.toBeDefined(); // Check if cookies are set
        });
        test("Login missing eamil and valid password ", async () => {
            const InputData = {
                password: "Psword123!"
            }
            const OutputData = { "errors": ["Invalid credentials"] }
            jest.spyOn(mockLoginUserUseCase, "execute").mockImplementation(() => { throw new Error() })

            const response = await request(server).post("/auth/login").send(InputData)

            expect(response.status).toBe(401)
            expect(mockLoginUserUseCase.execute).not.toBeCalled()
            expect(response.body).toStrictEqual(OutputData)
            expect(response.headers['set-cookie']).not.toBeDefined(); // Check if cookies are set
        });
    })
})
