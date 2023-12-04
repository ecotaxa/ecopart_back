import { NextFunction, Request, Response } from "express";
import { MiddlewareAuthCookie } from "../../../src/presentation/middleware/auth-cookie";
import 'dotenv/config'
import { JwtAdapter } from "../../../src/infra/auth/jsonwebtoken";
import { JwtPayload } from "jsonwebtoken";
import { CustomRequest } from "../../../src/domain/entities/auth";

class MockJwtAdapter extends JwtAdapter {
    sign(): string {
        throw new Error("Method not implemented.");
    }
    verify(): JwtPayload | string {
        throw new Error("Method not implemented.");
    }
}



const TEST_ACCESS_TOKEN_SECRET = process.env.TEST_ACCESS_TOKEN_SECRET || ''
const TEST_REFRESH_TOKEN_SECRET = process.env.TEST_REFRESH_TOKEN_SECRET || ''

describe("Authorization middleware", () => {
    let jwt: JwtAdapter
    let authorizationMiddleware: MiddlewareAuthCookie
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction = jest.fn();

    beforeEach(() => {
        jwt = new MockJwtAdapter()
        authorizationMiddleware = new MiddlewareAuthCookie(jwt, TEST_ACCESS_TOKEN_SECRET, TEST_REFRESH_TOKEN_SECRET);
        mockRequest = {};
        mockResponse = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };
        nextFunction = jest.fn();
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe("ACCESS TOKEN TESTS", () => {

        test('Without "access_token" auth cookie - should return error', async () => {

            const expectedResponse = { errors: ['Token missing. Please authenticate.'] }

            authorizationMiddleware.auth(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockResponse.status).toBeCalledWith(401);
            expect(mockResponse.send).toBeCalledWith(expectedResponse);
            expect(nextFunction).not.toBeCalled();
        });

        test('With expired "access_token" auth cookie - should return error', async () => {
            const expectedResponse = { errors: ['Token invalid or expired. Please authenticate.'] }
            mockRequest = {
                cookies: {
                    access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJmaXJzdE5hbWUiOiJKb2huIiwibGFzdE5hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwib3JnYW5pc2F0aW9uIjoiTE9WIiwiY291bnRyeSI6IkZyYW5jZSIsInVzZXJfcGxhbm5lZF91c2FnZSI6Ik1vbiB1c2FnZSIsInVzZXJfY3JlYXRpb25fZGF0ZSI6IjIwMjMtMDctMzEgMTc6MTg6NDcifSwiaWF0IjoxNjkyNjAyODY3LCJleHAiOjE2OTI2MDI4Njh9.kKL-coa_d11JqjV-J_Av8YSsEWYeHwG0RqqoX9G-zXg",
                },
            };
            authorizationMiddleware.auth(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockResponse.status).toBeCalledWith(401);
            expect(mockResponse.send).toBeCalledWith(expectedResponse);
            expect(nextFunction).not.toBeCalled();
        });


        test('With invalid "access_token" auth cookie - should return error', async () => {

            const expectedResponse = { errors: ['Token invalid or expired. Please authenticate.'] }

            mockRequest = {
                cookies: {
                    access_token: "fyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJmaXJzdE5hbWUiOiJKb2huIiwibGFzdE5hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwib3JnYW5pc2F0aW9uIjoiTE9WIiwiY291bnRyeSI6IkZyYW5jZSIsInVzZXJfcGxhbm5lZF91c2FnZSI6Ik1vbiB1c2FnZSIsInVzZXJfY3JlYXRpb25fZGF0ZSI6IjIwMjMtMDctMzEgMTc6MTg6NDcifSwiaWF0IjoxNjkyNjAyODY3LCJleHAiOjE2OTI2MDI4Njh9.kKL-coa_d11JqjV-J_Av8YSsEWYeHwG0RqqoX9G-zXg",
                },
            };

            authorizationMiddleware.auth(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockResponse.status).toBeCalledWith(401);
            expect(mockResponse.send).toBeCalledWith(expectedResponse);
            expect(nextFunction).not.toBeCalled();

        });

        test('With "access_token" auth cookie - should call next', async () => {
            const valid_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJmaXJzdE5hbWUiOiJKb2huIiwibGFzdE5hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwib3JnYW5pc2F0aW9uIjoiTE9WIiwiY291bnRyeSI6IkZyYW5jZSIsInVzZXJfcGxhbm5lZF91c2FnZSI6Ik1vbiB1c2FnZSIsInVzZXJfY3JlYXRpb25fZGF0ZSI6IjIwMjMtMDctMzEgMTc6MTg6NDcifSwiaWF0IjoxNjkyNjAyNzg4LCJleHAiOjU4NDk2MjgyNzg4fQ.Xf4khx3YYZus-f6Rt_L9crmUk23tLqdsamvukSSizOY"
            const expectedDecodedAccessToken = {
                "id": 1,
                "first_name": "John",
                "last_name": "Smith",
                "email": "john@gmail.com",
                is_admin: false,
                "status": "Pending",
                "organisation": "LOV",
                "country": "France",
                "user_planned_usage": "Mon usage",
                "user_creation_date": "2023-07-31 17:18:47",
                "iat": 1692612422,
                "exp": 1692614222
            }

            mockRequest = {
                cookies: {
                    access_token: valid_token
                },
            };

            jest.spyOn(jwt, "verify").mockImplementation(() => { return expectedDecodedAccessToken })

            authorizationMiddleware.auth(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );


            expect((mockRequest as CustomRequest).token).toEqual(expectedDecodedAccessToken);
            expect(jwt.verify).toHaveBeenCalledWith(valid_token, TEST_ACCESS_TOKEN_SECRET);
            expect(nextFunction).toBeCalledTimes(1);
        });
    })

    describe("REFRESH TOKEN TESTS", () => {
        test('Without "refresh_token" auth cookie - should return error', async () => {

            const expectedResponse = { errors: ['Refresh token missing. Please authenticate.'] }

            authorizationMiddleware.auth_refresh(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockResponse.status).toBeCalledWith(401);
            expect(mockResponse.send).toBeCalledWith(expectedResponse);
            expect(nextFunction).not.toBeCalled();
        });

        test('With expired "refresh_token" auth cookie - should return error', async () => {
            const expiredRefreshToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJmaXJzdE5hbWUiOiJKb2huIiwibGFzdE5hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwib3JnYW5pc2F0aW9uIjoiTE9WIiwiY291bnRyeSI6IkZyYW5jZSIsInVzZXJfcGxhbm5lZF91c2FnZSI6Ik1vbiB1c2FnZSIsInVzZXJfY3JlYXRpb25fZGF0ZSI6IjIwMjMtMDctMzEgMTc6MTg6NDcifSwiaWF0IjoxNjkyNjk4MzUyLCJleHAiOjE2OTI2OTgzNTN9.p1Y9u9ikgGjkn8BKWDzaTLAiqSJNwoUGvvvQf1se0ZE"
            const expectedResponse = { errors: ['Refresh token invalid or expired. Please authenticate.'] }
            mockRequest = {
                cookies: {
                    refresh_token: expiredRefreshToken,
                },
            };


            authorizationMiddleware.auth_refresh(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockResponse.status).toBeCalledWith(401);
            expect(mockResponse.send).toBeCalledWith(expectedResponse);
            expect(nextFunction).not.toBeCalled();
        });


        test('With invalid "refresh_token" auth cookie - should return error', async () => {

            const invalidRefreshToken = "fyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJmaXJzdE5hbWUiOiJKb2huIiwibGFzdE5hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwib3JnYW5pc2F0aW9uIjoiTE9WIiwiY291bnRyeSI6IkZyYW5jZSIsInVzZXJfcGxhbm5lZF91c2FnZSI6Ik1vbiB1c2FnZSIsInVzZXJfY3JlYXRpb25fZGF0ZSI6IjIwMjMtMDctMzEgMTc6MTg6NDcifSwiaWF0IjoxNjkyNjk4MjYzLCJleHAiOjU4NDk2Mzc4MjYzfQ.V0lcrrAPrYW1eE0Pq9J8CgfjH9ljk9-QdDjjlgmYxoM"
            const expectedResponse = { errors: ['Refresh token invalid or expired. Please authenticate.'] }

            mockRequest = {
                cookies: {
                    refresh_token: invalidRefreshToken,
                },
            };

            authorizationMiddleware.auth_refresh(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            expect(mockResponse.status).toBeCalledWith(401);
            expect(mockResponse.send).toBeCalledWith(expectedResponse);
            expect(nextFunction).not.toBeCalled();

        });

        test('With "refresh_token" auth cookie - should call next', async () => {

            const valid_refresh_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJmaXJzdE5hbWUiOiJKb2huIiwibGFzdE5hbWUiOiJTbWl0aCIsImVtYWlsIjoiam9obkBnbWFpbC5jb20iLCJzdGF0dXMiOiJQZW5kaW5nIiwib3JnYW5pc2F0aW9uIjoiTE9WIiwiY291bnRyeSI6IkZyYW5jZSIsInVzZXJfcGxhbm5lZF91c2FnZSI6Ik1vbiB1c2FnZSIsInVzZXJfY3JlYXRpb25fZGF0ZSI6IjIwMjMtMDctMzEgMTc6MTg6NDcifSwiaWF0IjoxNjkyNjk4MjYzLCJleHAiOjU4NDk2Mzc4MjYzfQ.V0lcrrAPrYW1eE0Pq9J8CgfjH9ljk9-QdDjjlgmYxoM"
            const expectedDecodedRefreshToken = {
                user_id: 1,
                first_name: 'John',
                last_name: 'Smith',
                email: 'john@gmail.com',
                is_admin: false,
                status: 'Pending',
                organisation: 'LOV',
                country: 'France',
                user_planned_usage: 'Mon usage',
                user_creation_date: '2023-07-31 17:18:47',
                iat: 1692612422,
                exp: 1692614222
            }

            mockRequest = {
                cookies: {
                    refresh_token: valid_refresh_token
                },
            };

            jest.spyOn(jwt, "verify").mockImplementation(() => { return expectedDecodedRefreshToken })

            authorizationMiddleware.auth_refresh(
                mockRequest as Request,
                mockResponse as Response,
                nextFunction
            );

            // Check that auth_refresh adds decrypted token to req.token
            expect((mockRequest as CustomRequest).token).toEqual(expectedDecodedRefreshToken);
            expect(jwt.verify).toHaveBeenCalledWith(valid_refresh_token, TEST_REFRESH_TOKEN_SECRET);
            expect(nextFunction).toBeCalledTimes(1);
        });
    })
});

