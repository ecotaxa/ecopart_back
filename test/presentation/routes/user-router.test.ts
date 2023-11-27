import request from "supertest";
import server from '../../../src/server'

import UserRouter from '../../../src/presentation/routers/user-router'

import { UserResponseModel, UserRequesCreationtModel } from "../../../src/domain/entities/user";

import { CreateUserUseCase } from "../../../src/domain/interfaces/use-cases/user/create-user";
import { GetAllUsersUseCase } from "../../../src/domain/interfaces/use-cases/user/get-all-users";
import { UpdateUserUseCase } from "../../../src/domain/interfaces/use-cases/user/update-user";
import { ValidUserUseCase } from "../../../src/domain/interfaces/use-cases/user/valid-user";

import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { IMiddlewareUserValidation } from "../../../src/presentation/interfaces/middleware/user_validation";

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
class MockUpdateUserUseCase implements UpdateUserUseCase {
    execute(): Promise<UserResponseModel> {
        throw new Error("Method not implemented.")
    }
}

class MockValidUserUseCase implements ValidUserUseCase {
    execute(): Promise<void> {
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
class MockMiddlewareUserValidation implements IMiddlewareUserValidation {
    rulesUserRequesCreationtModel = []
    rulesUserRequestModel = []
    rulesUserUpdateModel = []
    rulesUserResponseModel = []
    constructor() { }
}

describe("User Router", () => {
    let mockMiddlewareAuth: MockMiddlewareAuth;
    let mockMiddlewareUserValidation: MockMiddlewareUserValidation;
    let mockCreateUserUseCase: CreateUserUseCase;
    let mockGetAllUsersUseCase: GetAllUsersUseCase;
    let mockUpdateUserUseCase: UpdateUserUseCase;
    let mockValidUserUseCase: ValidUserUseCase;

    beforeAll(() => {
        mockMiddlewareAuth = new MockMiddlewareAuth()
        mockGetAllUsersUseCase = new MockGetAllUsersUseCase()
        mockCreateUserUseCase = new MockCreateUserUseCase()
        mockUpdateUserUseCase = new MockUpdateUserUseCase()
        mockValidUserUseCase = new MockValidUserUseCase()
        mockMiddlewareUserValidation = new MockMiddlewareUserValidation()


        server.use("/users", UserRouter(mockMiddlewareAuth, mockMiddlewareUserValidation, mockGetAllUsersUseCase, mockCreateUserUseCase, mockUpdateUserUseCase, mockValidUserUseCase))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

    describe("Tests for GET /users", () => {

        test("Should return 200 with data", async () => {
            const ExpectedData: UserResponseModel[] = [{
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
            }, {
                user_id: 2,
                last_name: "Smith",
                first_name: "Jim",
                email: "jim@gmail.com",
                is_admin: false,
                valid_email: true,
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

        test("Get users fail for unexepted reason", async () => {
            const expectedResponse = { errors: ["Can't get users"] }
            jest.spyOn(mockGetAllUsersUseCase, "execute").mockImplementation(() => { throw new Error() })
            jest.spyOn(mockMiddlewareAuth, "auth")
            const response = await request(server).get("/users")

            expect(response.status).toBe(500)
            expect(mockGetAllUsersUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    })

    describe("POST /users", () => {

        test("POST /users", async () => {
            const InputData: UserRequesCreationtModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "test123!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            const OutputData: UserResponseModel = {
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
            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).post("/users").send(InputData)
            expect(response.status).toBe(201)
            expect(mockCreateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(OutputData)
        });

        test("POST /users fail for unexepted reason", async () => {
            const InputData: UserRequesCreationtModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "test123!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            const expectedResponse = { errors: ["Can't create user"] }


            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error()))

            const response = await request(server).post("/users").send(InputData)

            expect(response.status).toBe(500)
            expect(mockCreateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("POST /users fail for Valid user already exist reason", async () => {
            const InputData: UserRequesCreationtModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "test123!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            const expectedResponse = { errors: ["Can't create user"] }


            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error("Valid user already exist")))

            const response = await request(server).post("/users").send(InputData)

            expect(response.status).toBe(403)
            expect(mockCreateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("POST /users fail for Can't update preexistent user reason", async () => {
            const InputData: UserRequesCreationtModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "test123!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            const expectedResponse = { errors: ["Can't update preexistent user"] }


            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error("Can't update preexistent user")))

            const response = await request(server).post("/users").send(InputData)

            expect(response.status).toBe(403)
            expect(mockCreateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("POST /users fail for Can't find updated preexistent user reason", async () => {
            const InputData: UserRequesCreationtModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "test123!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            const expectedResponse = { errors: ["Can't find updated preexistent user"] }


            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error("Can't find updated preexistent user")))

            const response = await request(server).post("/users").send(InputData)

            expect(response.status).toBe(404)
            expect(mockCreateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
        test("POST /users fail for Can't find created user reason", async () => {
            const InputData: UserRequesCreationtModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "test123!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            const expectedResponse = { errors: ["Can't find created user"] }


            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error("Can't find created user")))

            const response = await request(server).post("/users").send(InputData)

            expect(response.status).toBe(404)
            expect(mockCreateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

    })

    describe("PATCH /users", () => {

        test("PATCH /users", async () => {
            const user_to_update = {
                last_name: "Smith",
                first_name: "John"
            }
            const OutputData: UserResponseModel = {
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
            jest.spyOn(mockUpdateUserUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).patch("/users/1").send(user_to_update)
            expect(response.status).toBe(200)
        });

        test("PATCH /users fail for unexepted reason", async () => {
            const user_to_update = {
                last_name: "Smith",
                first_name: "John"
            }
            const expectedResponse = { errors: ["Can't update user"] }


            jest.spyOn(mockUpdateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error()))
            const response = await request(server).patch("/users/2").send(user_to_update)

            expect(response.status).toBe(500)
            expect(mockUpdateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)

        });

        test("PATCH /users fail for Logged user cannot update this property or user reason", async () => {
            const user_to_update = {
                last_name: "Smith",
                first_name: "John"
            }
            const expectedResponse = { errors: ["Logged user cannot update this property or user"] }


            jest.spyOn(mockUpdateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error("Logged user cannot update this property or user")))
            const response = await request(server).patch("/users/2").send(user_to_update)

            expect(response.status).toBe(401)
            expect(mockUpdateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)

        });

        test("PATCH /users fail for Can't find updated user reason", async () => {
            const user_to_update = {
                last_name: "Smith",
                first_name: "John"
            }
            const expectedResponse = { errors: ["Can't find updated user"] }


            jest.spyOn(mockUpdateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error("Can't find updated user")))
            const response = await request(server).patch("/users/2").send(user_to_update)

            expect(response.status).toBe(404)
            expect(mockUpdateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)

        });

    })


    describe("Tests for GET /users/:user_id/welcome/:confirmation_token", () => {

        test("Should return 200 with sucess message", async () => {
            const expectedResponse = { message: "Account activated, please login" }
            jest.spyOn(mockValidUserUseCase, "execute").mockImplementation(() => Promise.resolve())

            const response = await request(server).get("/users/1/welcome/123456789")

            expect(response.status).toBe(200)
            expect(mockValidUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("Get users welcome fail for unexepted reason", async () => {
            const expectedResponse = { errors: ["Can't welcome user"] }
            jest.spyOn(mockValidUserUseCase, "execute").mockImplementation(() => { throw new Error() })

            const response = await request(server).get("/users/1/welcome/123456789")

            expect(response.status).toBe(500)
            expect(mockValidUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("Get users welcome fail for Invalid confirmation token reason", async () => {
            const expectedResponse = { errors: ["Invalid confirmation token"] }
            jest.spyOn(mockValidUserUseCase, "execute").mockImplementation(() => { throw new Error("Invalid confirmation token") })

            const response = await request(server).get("/users/1/welcome/123456789")

            expect(response.status).toBe(401)
            expect(mockValidUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("Get users welcome fail for Invalid confirmation code reason", async () => {
            const expectedResponse = { errors: ["Invalid confirmation code"] }
            jest.spyOn(mockValidUserUseCase, "execute").mockImplementation(() => { throw new Error("Invalid confirmation code") })

            const response = await request(server).get("/users/1/welcome/123456789")

            expect(response.status).toBe(401)
            expect(mockValidUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("Get users welcome fail for User vallidation forbidden reason", async () => {
            const expectedResponse = { errors: ["User vallidation forbidden"] }
            jest.spyOn(mockValidUserUseCase, "execute").mockImplementation(() => { throw new Error("User vallidation forbidden") })

            const response = await request(server).get("/users/1/welcome/123456789")

            expect(response.status).toBe(403)
            expect(mockValidUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("Get users welcome fail for Can't update user reason", async () => {
            const expectedResponse = { errors: ["Can't update user"] }
            jest.spyOn(mockValidUserUseCase, "execute").mockImplementation(() => { throw new Error("Can't update user") })

            const response = await request(server).get("/users/1/welcome/123456789")

            expect(response.status).toBe(500)
            expect(mockValidUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("Get users welcome fail for Can't find updated user reason", async () => {
            const expectedResponse = { errors: ["Can't find updated user"] }
            jest.spyOn(mockValidUserUseCase, "execute").mockImplementation(() => { throw new Error("Can't find updated user") })

            const response = await request(server).get("/users/1/welcome/123456789")

            expect(response.status).toBe(404)
            expect(mockValidUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("Get users welcome fail for Can't validate user reason", async () => {
            const expectedResponse = { errors: ["Can't validate user"] }
            jest.spyOn(mockValidUserUseCase, "execute").mockImplementation(() => { throw new Error("Can't validate user") })

            const response = await request(server).get("/users/1/welcome/123456789")

            expect(response.status).toBe(500)
            expect(mockValidUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    })


})
