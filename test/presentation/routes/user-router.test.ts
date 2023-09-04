import request from "supertest";
import server from '../../../src/server'

import UserRouter from '../../../src/presentation/routers/user-router'

import { UserResponseModel, UserRequesCreationtModel } from "../../../src/domain/entities/user";

import { CreateUserUseCase } from "../../../src/domain/interfaces/use-cases/user/create-user";
import { GetAllUsersUseCase } from "../../../src/domain/interfaces/use-cases/user/get-all-users";

import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { Request, Response, NextFunction } from "express";

class MockGetAllUsersUseCase implements GetAllUsersUseCase {
    execute(): Promise<UserResponseModel[]> {
        throw new Error("Method not implemented.")
    }
}

class MockCreateUserUseCase implements CreateUserUseCase {
    execute(): Promise<UserResponseModel> {
        throw new Error("Method not implemented.")
    }
}
class MockMiddlewareAuth implements MiddlewareAuth {
    auth(_: Request, __: Response, next: NextFunction): void {
        next()
    }
    auth_refresh(): void {
        throw new Error("Method not implemented.")
    }
}

describe("User Router", () => {
    let mockMiddlewareAuth: MockMiddlewareAuth;
    let mockCreateUserUseCase: CreateUserUseCase;
    let mockGetAllUsersUseCase: GetAllUsersUseCase;

    beforeAll(() => {
        mockMiddlewareAuth = new MockMiddlewareAuth()
        mockGetAllUsersUseCase = new MockGetAllUsersUseCase()
        mockCreateUserUseCase = new MockCreateUserUseCase()
        server.use("/users", UserRouter(mockMiddlewareAuth, mockGetAllUsersUseCase, mockCreateUserUseCase))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

    describe("Tests for GET /users", () => {

        test("should return 200 with data", async () => {
            const ExpectedData: UserResponseModel[] = [{
                id: 1,
                lastName: "Smith",
                firstName: "John",
                email: "john@gmail.com",
                status: "Pending",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }, {
                id: 2,
                lastName: "Smith",
                firstName: "Jim",
                email: "jim@gmail.com",
                status: "Pending",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }];
            jest.spyOn(mockGetAllUsersUseCase, "execute").mockImplementation(() => Promise.resolve(ExpectedData))
            jest.spyOn(mockMiddlewareAuth, "auth")
            const response = await request(server).get("/users")

            expect(response.status).toBe(200)
            expect(mockGetAllUsersUseCase.execute).toBeCalledTimes(1)
            //  expect(mockMiddlewareAuth.auth).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(ExpectedData)

        });

        test("GET /users returns 401 on use case unauthorized missing cookie", async () => {
            // TODO
        });
    })

    describe("POST /users", () => {

        test("POST /users", async () => {
            const InputData: UserRequesCreationtModel = {
                lastName: "Smith",
                firstName: "John",
                email: "john@gmail.com",
                password: "test123!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            const OutputData: UserResponseModel = {
                id: 1,
                lastName: "Smith",
                firstName: "John",
                email: "john@gmail.com",
                status: "Pending",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }
            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).post("/users").send(InputData)
            expect(response.status).toBe(201)
        });

        test("POST /users returns 500 on use case error", async () => {
            const InputData: UserRequesCreationtModel = {
                lastName: "Smith",
                firstName: "John",
                email: "john@gmail.com",
                password: "test123!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error()))
            const response = await request(server).post("/users").send(InputData)
            expect(response.status).toBe(500)
        });
    })
})