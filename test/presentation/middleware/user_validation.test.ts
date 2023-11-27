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
import { MiddlewareUserValidation } from "../../../src/presentation/middleware/user_validation";

import { Request, Response, NextFunction } from "express";
import { CountriesAdapter } from "../../../src/infra/countries/country";

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

describe("User Router", () => {
    let countriesAdapter: CountriesAdapter
    let mockMiddlewareAuth: MockMiddlewareAuth;
    let middlewareUserValidation: IMiddlewareUserValidation;
    let mockCreateUserUseCase: CreateUserUseCase;
    let mockGetAllUsersUseCase: GetAllUsersUseCase;
    let mockUpdateUserUseCase: UpdateUserUseCase;
    let mockValidUserUseCase: ValidUserUseCase;

    beforeAll(() => {
        mockMiddlewareAuth = new MockMiddlewareAuth()
        countriesAdapter = new CountriesAdapter()
        middlewareUserValidation = new MiddlewareUserValidation(countriesAdapter)
        mockGetAllUsersUseCase = new MockGetAllUsersUseCase()
        mockCreateUserUseCase = new MockCreateUserUseCase()
        mockUpdateUserUseCase = new MockUpdateUserUseCase()
        mockValidUserUseCase = new MockValidUserUseCase()


        server.use("/users", UserRouter(mockMiddlewareAuth, middlewareUserValidation, mockGetAllUsersUseCase, mockCreateUserUseCase, mockUpdateUserUseCase, mockValidUserUseCase))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

    describe("Test user router create user validation", () => {
        test("Create user all params are valid", async () => {
            const InputData: UserRequesCreationtModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "Test123!",
                organisation: "LOV",
                country: "FR",
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
                country: "FR",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'

            }
            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))

            const response = await request(server).post("/users").send(InputData)

            expect(response.status).toBe(201)
            expect(mockCreateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(OutputData)
        });

        test("Sanitize email and organisation", async () => {
            const InputData: UserRequesCreationtModel = {
                last_name: "Smith",
                first_name: "John",
                email: "John@gmail.com",
                password: "Test123!",
                organisation: "LOV ",
                country: "FR",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            const sanitizedInputData: UserRequesCreationtModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "Test123!",
                organisation: "LOV",
                country: "FR",
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
                country: "FR",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'

            }
            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))

            const response = await request(server).post("/users").send(InputData)

            expect(response.status).toBe(201)
            expect(mockCreateUserUseCase.execute).toBeCalledWith(sanitizedInputData)
            expect(mockCreateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(OutputData)
        });

        test("Unvalid country code", async () => {
            const InputData: UserRequesCreationtModel = {
                last_name: "Smith",
                first_name: "John",
                email: "John@gmail.com",
                password: "Test123!",
                organisation: "LOV ",
                country: "FR56GG",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }

            const OutputData = {
                "errors": [
                    {
                        "location": "body",
                        "msg": "Invalid country. Please select from the list.",
                        "path": "country",
                        "type": "field",
                        "value": "FR56GG",
                    },
                ]
            }
            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => { throw new Error() })

            const response = await request(server).post("/users").send(InputData)

            expect(response.status).toBe(422)
            expect(mockCreateUserUseCase.execute).not.toBeCalled()
            expect(response.body).toStrictEqual(OutputData)
        });

        test("Missing first and last name", async () => {
            const InputData = {
                email: "John@gmail.com",
                password: "Test123!",
                organisation: "LOV ",
                country: "FR56GG",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }

            const OutputData = {
                "errors": [
                    {
                        "location": "body",
                        "msg": "First name is required.",
                        "path": "first_name",
                        "type": "field",
                        "value": "",
                    },
                    {
                        "location": "body",
                        "msg": "Last name is required.",
                        "path": "last_name",
                        "type": "field",
                        "value": "",
                    },
                    {
                        "location": "body",
                        "msg": "Invalid country. Please select from the list.",
                        "path": "country",
                        "type": "field",
                        "value": "FR56GG",
                    }
                ]
            }
            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => { throw new Error() })

            const response = await request(server).post("/users").send(InputData)

            expect(response.status).toBe(422)
            expect(mockCreateUserUseCase.execute).not.toBeCalled()
            expect(response.body).toStrictEqual(OutputData)
        });

    })
})
