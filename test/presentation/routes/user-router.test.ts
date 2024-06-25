import request from "supertest";
import server from '../../../src/server'

import UserRouter from '../../../src/presentation/routers/user-router'

import { UserResponseModel, UserRequestCreationModel } from "../../../src/domain/entities/user";
import { CustomRequest, DecodedToken } from "../../../src/domain/entities/auth";
import { SearchInfo } from "../../../src/domain/entities/search";

import { CreateUserUseCase } from "../../../src/domain/interfaces/use-cases/user/create-user";
import { UpdateUserUseCase } from "../../../src/domain/interfaces/use-cases/user/update-user";
import { ValidUserUseCase } from "../../../src/domain/interfaces/use-cases/user/valid-user";
import { DeleteUserUseCase } from "../../../src/domain/interfaces/use-cases/user/delete-user";
import { SearchUsersUseCase } from "../../../src/domain/interfaces/use-cases/user/search-user";

import { MiddlewareAuth } from "../../../src/presentation/interfaces/middleware/auth";
import { IMiddlewareUserValidation } from "../../../src/presentation/interfaces/middleware/user-validation";

import { Request, Response, NextFunction } from "express";

class MockSearchUsersUseCase implements SearchUsersUseCase {
    execute(): Promise<{ users: UserResponseModel[], search_info: SearchInfo }> {
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
    auth(req: Request, __: Response, next: NextFunction): void {
        (req as CustomRequest).token = ({
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            valid_email: false,
            confirmation_code: "123456",
            is_admin: false,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00',

            iat: 1693237789,
            exp: 1724795389
        } as DecodedToken);
        next();
    }
    auth_refresh(): void {
        throw new Error("Method not implemented.")
    }
}
class MockDeleteUserUseCase implements DeleteUserUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented.")
    }
}
class MockMiddlewareUserValidation implements IMiddlewareUserValidation {
    rulesUserRequestCreationModel = []
    rulesUserRequestModel = []
    rulesUserUpdateModel = []
    rulesUserResponseModel = []
    rulesGetUsers = []
}

describe("User Router", () => {
    let mockMiddlewareAuth: MockMiddlewareAuth;
    let mockMiddlewareUserValidation: MockMiddlewareUserValidation;
    let mockCreateUserUseCase: CreateUserUseCase;
    let mockUpdateUserUseCase: UpdateUserUseCase;
    let mockValidUserUseCase: ValidUserUseCase;
    let mockDeleteUserUseCase: DeleteUserUseCase;
    let mockSearchUsersUseCase: SearchUsersUseCase;

    beforeAll(() => {
        mockMiddlewareAuth = new MockMiddlewareAuth()
        mockCreateUserUseCase = new MockCreateUserUseCase()
        mockUpdateUserUseCase = new MockUpdateUserUseCase()
        mockValidUserUseCase = new MockValidUserUseCase()
        mockDeleteUserUseCase = new MockDeleteUserUseCase()
        mockMiddlewareUserValidation = new MockMiddlewareUserValidation()
        mockSearchUsersUseCase = new MockSearchUsersUseCase()

        server.use("/users", UserRouter(mockMiddlewareAuth, mockMiddlewareUserValidation, mockCreateUserUseCase, mockUpdateUserUseCase, mockValidUserUseCase, mockDeleteUserUseCase, mockSearchUsersUseCase))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

    describe("Tests for GET /users", () => {
        test("Should return 200 with data", async () => {
            const ExpectedData = {
                users:
                    [{
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
                    }],
                search_info: {
                    total: 2,
                    limit: 10,
                    total_on_page: 2,
                    page: 1,
                    pages: 1
                }
            };
            jest.spyOn(mockSearchUsersUseCase, "execute").mockImplementation(() => Promise.resolve(ExpectedData))
            jest.spyOn(mockMiddlewareAuth, "auth")
            const response = await request(server).get("/users")

            expect(response.status).toBe(200)
            expect(mockSearchUsersUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(ExpectedData)

        });

        test("failed if current user is deleted", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(mockSearchUsersUseCase, "execute").mockImplementation(() => { throw new Error("User cannot be used") })
            const response = await request(server).get("/users")
            expect(response.status).toBe(403)
            expect(mockSearchUsersUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("failed if unexisting or unauthorized parameters", async () => {
            const expectedResponse = "Unauthorized or unexisting parameters"
            jest.spyOn(mockSearchUsersUseCase, "execute").mockImplementation(() => { throw new Error("Unauthorized or unexisting parameters : Unauthorized sort_by: validemail") })
            const response = await request(server).get("/users")

            expect(response.status).toBe(401)
            expect(mockSearchUsersUseCase.execute).toBeCalledTimes(1)
            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse));
        });

        test("failed if invalid sorting statement", async () => {
            const expectedResponse = "Invalid sorting statement"
            jest.spyOn(mockSearchUsersUseCase, "execute").mockImplementation(() => { throw new Error("Invalid sorting statement : 'des'") })
            const response = await request(server).get("/users")

            expect(response.status).toBe(401)
            expect(mockSearchUsersUseCase.execute).toBeCalledTimes(1)

            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse));
        });

        test("Get users fail for unexepted reason", async () => {
            const expectedResponse = { errors: ["Cannot get users"] }
            jest.spyOn(mockSearchUsersUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).get("/users")

            expect(response.status).toBe(500)
            expect(mockSearchUsersUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    })

    describe("Tests for POST /users/searches", () => {
        test("Should return 200 with data", async () => {
            const ExpectedData = {
                users: [{
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
                }],
                search_info: {
                    total: 2,
                    limit: 10,
                    total_on_page: 2,
                    page: 1,
                    pages: 1
                }
            };
            jest.spyOn(mockSearchUsersUseCase, "execute").mockImplementation(() => Promise.resolve(ExpectedData))
            const response = await request(server).post("/users/searches")

            expect(response.status).toBe(200)
            expect(mockSearchUsersUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(ExpectedData)
        });

        test("failed if current user is deleted", async () => {
            const expectedResponse = { errors: ["User cannot be used"] }
            jest.spyOn(mockSearchUsersUseCase, "execute").mockImplementation(() => { throw new Error("User cannot be used") })
            const response = await request(server).post("/users/searches")

            expect(response.status).toBe(403)
            expect(mockSearchUsersUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("failed if unexisting or unauthorized parameters", async () => {
            const expectedResponse = "Unauthorized or unexisting parameters"
            jest.spyOn(mockSearchUsersUseCase, "execute").mockImplementation(() => { throw new Error("Unauthorized or unexisting parameters : Unauthorized sort_by: validemail") })
            const response = await request(server).post("/users/searches")

            expect(response.status).toBe(401)
            expect(mockSearchUsersUseCase.execute).toBeCalledTimes(1)
            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse));
        });

        test("failed if invalid sorting statement", async () => {
            const expectedResponse = "Invalid sorting statement"
            jest.spyOn(mockSearchUsersUseCase, "execute").mockImplementation(() => { throw new Error("Invalid sorting statement : 'des'") })
            const response = await request(server).post("/users/searches")

            expect(response.status).toBe(401)
            expect(mockSearchUsersUseCase.execute).toBeCalledTimes(1)

            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse));
        });

        test("failed if Invalid filter statement ", async () => {
            const expectedResponse = "Invalid filter statement"
            jest.spyOn(mockSearchUsersUseCase, "execute").mockImplementation(() => { throw new Error("Invalid filter statement Value for operator 'IN' must be an array in filter: {field: user_id, operator: IN, value:1 } ") })
            const response = await request(server).post("/users/searches")

            expect(response.status).toBe(401)
            expect(mockSearchUsersUseCase.execute).toBeCalledTimes(1)
            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse));
        });

        test("Get users fail for unexepted reason", async () => {
            const expectedResponse = { errors: ["Cannot search users"] }
            jest.spyOn(mockSearchUsersUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).post("/users/searches")

            expect(response.status).toBe(500)
            expect(mockSearchUsersUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    })

    describe("POST /users", () => {

        test("POST /users", async () => {
            const InputData: UserRequestCreationModel = {
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
            const InputData: UserRequestCreationModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "test123!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            const expectedResponse = { errors: ["Cannot create user"] }


            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error()))

            const response = await request(server).post("/users").send(InputData)

            expect(response.status).toBe(500)
            expect(mockCreateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("POST /users fail for Valid user already exist reason", async () => {
            const InputData: UserRequestCreationModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "test123!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            const expectedResponse = { errors: ["Cannot create user"] }


            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error("Valid user already exist")))

            const response = await request(server).post("/users").send(InputData)

            expect(response.status).toBe(403)
            expect(mockCreateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("POST /users fail for User is deleted", async () => {
            const InputData: UserRequestCreationModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "test123!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            const expectedResponse = { errors: ["User is deleted"] }


            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error("User is deleted")))

            const response = await request(server).post("/users").send(InputData)

            expect(response.status).toBe(403)
            expect(mockCreateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("POST /users fail for Cannot update preexistent user reason", async () => {
            const InputData: UserRequestCreationModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "test123!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            const expectedResponse = { errors: ["Cannot update preexistent user"] }


            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error("Cannot update preexistent user")))

            const response = await request(server).post("/users").send(InputData)

            expect(response.status).toBe(403)
            expect(mockCreateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("POST /users fail for Cannot find updated preexistent user reason", async () => {
            const InputData: UserRequestCreationModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "test123!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            const expectedResponse = { errors: ["Cannot find updated preexistent user"] }


            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error("Cannot find updated preexistent user")))

            const response = await request(server).post("/users").send(InputData)

            expect(response.status).toBe(404)
            expect(mockCreateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("POST /users fail for Cannot find created user reason", async () => {
            const InputData: UserRequestCreationModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "test123!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            const expectedResponse = { errors: ["Cannot find created user"] }


            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error("Cannot find created user")))

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
            const expectedResponse = { errors: ["Cannot update user"] }

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

        test("PATCH /users fail for User is deleted", async () => {
            const user_to_update = {
                last_name: "Smith",
                first_name: "John"
            }
            const expectedResponse = { errors: ["User is deleted"] }


            jest.spyOn(mockUpdateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error("User is deleted")))
            const response = await request(server).patch("/users/2").send(user_to_update)

            expect(response.status).toBe(403)
            expect(mockUpdateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("PATCH /users fail for Unauthorized or unexisting parameters reason", async () => {
            const user_to_update = {
                last_name: "Smith",
                first_name: "John"
            }
            const expectedResponse = "Unauthorized or unexisting parameters"
            jest.spyOn(mockUpdateUserUseCase, "execute").mockImplementation(() => { throw new Error("Unauthorized or unexisting parameters") })
            const response = await request(server).patch("/users/2").send(user_to_update)

            expect(response.status).toBe(401)
            expect(mockUpdateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body.errors[0]).toEqual(expect.stringContaining(expectedResponse))
        });

        test("PATCH /users fail for Cannot find updated user reason", async () => {
            const user_to_update = {
                last_name: "Smith",
                first_name: "John"
            }
            const expectedResponse = { errors: ["Cannot find updated user"] }


            jest.spyOn(mockUpdateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error("Cannot find updated user")))
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
            const expectedResponse = { errors: ["Cannot welcome user"] }
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

        test("Get users welcome fail for User is deleted", async () => {
            const expectedResponse = { errors: ["User is deleted"] }
            jest.spyOn(mockValidUserUseCase, "execute").mockImplementation(() => { throw new Error("User is deleted") })

            const response = await request(server).get("/users/1/welcome/123456789")

            expect(response.status).toBe(403)
            expect(mockValidUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("Get users welcome fail for Invalid confirmation code reason", async () => {
            const expectedResponse = { errors: ["Invalid confirmation token"] }
            jest.spyOn(mockValidUserUseCase, "execute").mockImplementation(() => { throw new Error("Invalid confirmation token") })

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

        test("Get users welcome fail for Cannot update user reason", async () => {
            const expectedResponse = { errors: ["Cannot update user"] }
            jest.spyOn(mockValidUserUseCase, "execute").mockImplementation(() => { throw new Error("Cannot update user") })

            const response = await request(server).get("/users/1/welcome/123456789")

            expect(response.status).toBe(500)
            expect(mockValidUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("Get users welcome fail for Cannot find updated user reason", async () => {
            const expectedResponse = { errors: ["Cannot find updated user"] }
            jest.spyOn(mockValidUserUseCase, "execute").mockImplementation(() => { throw new Error("Cannot find updated user") })

            const response = await request(server).get("/users/1/welcome/123456789")

            expect(response.status).toBe(404)
            expect(mockValidUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("Get users welcome fail for Cannot validate user reason", async () => {
            const expectedResponse = { errors: ["Cannot validate user"] }
            jest.spyOn(mockValidUserUseCase, "execute").mockImplementation(() => { throw new Error("Cannot validate user") })

            const response = await request(server).get("/users/1/welcome/123456789")

            expect(response.status).toBe(500)
            expect(mockValidUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(expectedResponse)
        });
    })
    describe("DELETE /users/:user_id", () => {

        test("DELETE /users by non admin", async () => {
            const expectedResponse = { message: "You have been Logged Out and permanently deleted" }

            jest.spyOn(mockDeleteUserUseCase, "execute").mockImplementation(() => Promise.resolve())

            const response = await request(server).delete("/users/1")
            expect(response.status).toBe(200)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("DELETE /users by admin", async () => {
            const expectedResponse = { message: "User successfully deleted" }

            jest.spyOn(mockDeleteUserUseCase, "execute").mockImplementation(() => Promise.resolve())
            const response = await request(server).delete("/users/2")
            expect(response.status).toBe(200)
            expect(response.body).toStrictEqual(expectedResponse)
        });



        test("DELETE /users fail for Logged user cannot delete this users hould return 401", async () => {
            const expectedResponse = { errors: ["Logged user cannot delete this user"] }
            jest.spyOn(mockDeleteUserUseCase, "execute").mockImplementation(() => Promise.reject(Error("Logged user cannot delete this user")))
            const response = await request(server).delete("/users/1")
            expect(response.status).toBe(401)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("DELETE /users fail for Cannot find user to delete should return 404", async () => {
            const expectedResponse = { errors: ["Cannot find user to delete"] }
            jest.spyOn(mockDeleteUserUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot find user to delete")))
            const response = await request(server).delete("/users/1")
            expect(response.status).toBe(404)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("DELETE /users fail for User is deleted should return 403", async () => {
            const expectedResponse = { errors: ["User is deleted"] }
            jest.spyOn(mockDeleteUserUseCase, "execute").mockImplementation(() => Promise.reject(new Error("User is deleted")))
            const response = await request(server).delete("/users/1")
            expect(response.status).toBe(403)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("DELETE /users fail for Cannot find deleted user should return 500", async () => {
            const expectedResponse = { errors: ["Cannot find deleted user"] }
            jest.spyOn(mockDeleteUserUseCase, "execute").mockImplementation(() => Promise.reject(new Error("Cannot find deleted user")))
            const response = await request(server).delete("/users/1")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });

        test("DELETE /users fail for Cannot delete user should return 500", async () => {
            const expectedResponse = { errors: ["Cannot delete user"] }
            jest.spyOn(mockDeleteUserUseCase, "execute").mockImplementation(() => Promise.reject(new Error()))
            const response = await request(server).delete("/users/1")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual(expectedResponse)
        });

    })

})
