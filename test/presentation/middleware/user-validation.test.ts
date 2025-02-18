import request from "supertest";
import server from '../../../src/server'

import UserRouter from '../../../src/presentation/routers/user-router'

import { UserResponseModel, UserRequestCreationModel } from "../../../src/domain/entities/user";

import { CreateUserUseCase } from "../../../src/domain/interfaces/use-cases/user/create-user";
import { UpdateUserUseCase } from "../../../src/domain/interfaces/use-cases/user/update-user";
import { ValidUserUseCase } from "../../../src/domain/interfaces/use-cases/user/valid-user";
import { DeleteUserUseCase } from "../../../src/domain/interfaces/use-cases/user/delete-user";
import { SearchUsersUseCase } from "../../../src/domain/interfaces/use-cases/user/search-user";
import { LoginEcotaxaAccountUseCase } from "../../../src/domain/interfaces/use-cases/ecotaxa_account/login-ecotaxa_account";
import { LogoutEcotaxaAccountUseCase } from "../../../src/domain/interfaces/use-cases/ecotaxa_account/logout-ecotaxa_account";
import { SearchEcotaxaAccountsUseCase } from "../../../src/domain/interfaces/use-cases/ecotaxa_account/search-ecotaxa_account";

import { IMiddlewareUserValidation } from "../../../src/presentation/interfaces/middleware/user-validation";
import { MiddlewareUserValidation } from "../../../src/presentation/middleware/user-validation";

import { CountriesAdapter } from "../../../src/infra/countries/country";
import { SearchInfo } from "../../../src/domain/entities/search";

import { MockCreateUserUseCase, MockDeleteUserUseCase, MockLoginEcotaxaAccountUseCase, MockLogoutEcotaxaAccountUseCase, MockMiddlewareAuth, MockSearchEcotaxaAccountsUseCase, MockSearchUsersUseCase, MockUpdateUserUseCase, MockValidUserUseCase } from "../../mocks/user-mock";
import { MiddlewareAuthValidation } from "../../../src/presentation/middleware/auth-validation";
import { IMiddlewareAuthValidation } from "../../../src/presentation/interfaces/middleware/auth-validation";

describe("User Router", () => {
    let countriesAdapter: CountriesAdapter
    let mockMiddlewareAuth: MockMiddlewareAuth;
    let middlewareUserValidation: IMiddlewareUserValidation;
    let middlewareAuthValidation: IMiddlewareAuthValidation;
    let mockCreateUserUseCase: CreateUserUseCase;
    let mockUpdateUserUseCase: UpdateUserUseCase;
    let mockValidUserUseCase: ValidUserUseCase;
    let mockDeleteUserUseCase: DeleteUserUseCase;
    let mockSearchUsersUseCase: SearchUsersUseCase;
    let mockLoginEcotaxaAccountUseCase: LoginEcotaxaAccountUseCase;
    let mockLogoutEcotaxaAccountUseCase: LogoutEcotaxaAccountUseCase;
    let mockSearchEcotaxaAccountsUseCase: SearchEcotaxaAccountsUseCase;

    beforeAll(() => {
        mockMiddlewareAuth = new MockMiddlewareAuth()
        countriesAdapter = new CountriesAdapter()
        middlewareUserValidation = new MiddlewareUserValidation(countriesAdapter)
        middlewareAuthValidation = new MiddlewareAuthValidation()
        mockCreateUserUseCase = new MockCreateUserUseCase()
        mockUpdateUserUseCase = new MockUpdateUserUseCase()
        mockValidUserUseCase = new MockValidUserUseCase()
        mockDeleteUserUseCase = new MockDeleteUserUseCase()
        mockSearchUsersUseCase = new MockSearchUsersUseCase()
        mockLoginEcotaxaAccountUseCase = new MockLoginEcotaxaAccountUseCase()
        mockLogoutEcotaxaAccountUseCase = new MockLogoutEcotaxaAccountUseCase()
        mockSearchEcotaxaAccountsUseCase = new MockSearchEcotaxaAccountsUseCase()


        server.use("/users", UserRouter(mockMiddlewareAuth, middlewareUserValidation, middlewareAuthValidation, mockCreateUserUseCase, mockUpdateUserUseCase, mockValidUserUseCase, mockDeleteUserUseCase, mockLoginEcotaxaAccountUseCase, mockLogoutEcotaxaAccountUseCase, mockSearchUsersUseCase, mockSearchEcotaxaAccountsUseCase))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

    describe("Test user router create user validation", () => {
        test("Create user all params are valid", async () => {
            const InputData: UserRequestCreationModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "Test123!",
                organisation: "LOV",
                country: "FR",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }

            const OutputData = { message: "User sucessfully created." }
            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.resolve())

            const response = await request(server).post("/users").send(InputData)

            expect(response.status).toBe(201)
            expect(mockCreateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(OutputData)
        });

        test("Sanitize email and organisation", async () => {
            const InputData: UserRequestCreationModel = {
                last_name: "Smith",
                first_name: "John",
                email: "John@gmail.com",
                password: "Test123!",
                organisation: "LOV ",
                country: "FR",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            const sanitizedInputData: UserRequestCreationModel = {
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                password: "Test123!",
                organisation: "LOV",
                country: "FR",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }

            const OutputData = { message: "User sucessfully created." }
            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.resolve())

            const response = await request(server).post("/users").send(InputData)

            expect(response.status).toBe(201)
            expect(mockCreateUserUseCase.execute).toBeCalledWith(sanitizedInputData)
            expect(mockCreateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(OutputData)
        });

        test("Unvalid country code", async () => {
            const InputData: UserRequestCreationModel = {
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

    describe("Test user router update user validation", () => {
        test("update user all params are valid", async () => {
            const user_to_update = {
                last_name: "Smith",
                first_name: "John",
                country: "FR"
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

            expect(response.body).toStrictEqual(OutputData)
            expect(mockUpdateUserUseCase.execute).toBeCalledTimes(1)
            expect(response.status).toBe(200)
        });

        test("Sanitize last_name and first_name", async () => {
            const user_to_update = {
                last_name: " Smith",
                first_name: " John "
            }
            const sanitizedInputData = {
                first_name: "John",
                last_name: "Smith",
                user_id: "1"
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
            expect(mockUpdateUserUseCase.execute).toBeCalledWith(undefined, sanitizedInputData)
            expect(response.body).toStrictEqual(OutputData)
        });
        test("update user invalid country", async () => {
            const user_to_update = {
                country: "FR56GG",
            }
            const OutputData = {
                errors: [
                    {
                        type: 'field',
                        value: 'FR56GG',
                        msg: 'Invalid country. Please select from the list.',
                        path: 'country',
                        location: 'body'
                    }
                ]
            }
            jest.spyOn(mockUpdateUserUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).patch("/users/1").send(user_to_update)

            expect(response.status).toBe(422)
            expect(mockCreateUserUseCase.execute).not.toBeCalled()
            console.log(response.body)
            expect(response.body).toStrictEqual(OutputData)
        });
    })
    describe("Test user router rules GetUsers", () => {
        test("Get users all params are valid", async () => {
            const OutputData: { users: UserResponseModel[], search_info: SearchInfo } = {
                users: [
                    {
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
                    }],
                search_info: { limit: 10, page: 1, pages: 1, total: 1, total_on_page: 1 }

            }
            const options = {
                page: 1,
                limit: 10,
                sort_by: "asc(user_id)"
            }
            jest.spyOn(mockSearchUsersUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).get("/users").query(options)

            expect(response.status).toBe(200)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockSearchUsersUseCase.execute).toBeCalledTimes(1)
        });

        test("Get users with invalid page", async () => {
            const options = {
                page: "a",
                limit: 10,
                sort_by: "asc(user_id)"
            }
            const OutputData = {
                "errors": [
                    {
                        "location": "query",
                        "msg": "Page must be a number and must be greater than 0.",
                        "path": "page",
                        "type": "field",
                        "value": "a"
                    }
                ]
            }
            jest.spyOn(mockSearchUsersUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).get("/users").query(options)

            expect(response.status).toBe(422)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockSearchUsersUseCase.execute).not.toBeCalled()
        });

        test("Get users with invalid limit", async () => {
            const options = {
                page: 1,
                limit: "a",
                sort_by: "asc(user_id)"
            }
            const OutputData = {
                "errors": [
                    {
                        "location": "query",
                        "msg": "Limit must be a number and must be greater than 0.",
                        "path": "limit",
                        "type": "field",
                        "value": "a"
                    }
                ]
            }
            jest.spyOn(mockSearchUsersUseCase, "execute").mockImplementation(() => { throw new Error() })
            const response = await request(server).get("/users").query(options)

            expect(response.status).toBe(422)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockSearchUsersUseCase.execute).not.toBeCalled()
        });

        test("get user with default params", async () => {
            const OutputData: { users: UserResponseModel[], search_info: SearchInfo } = {
                users: [
                    {
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
                    }],
                search_info: { limit: 10, page: 1, pages: 1, total: 1, total_on_page: 1 }

            }
            jest.spyOn(mockSearchUsersUseCase, "execute").mockImplementation(() => Promise.resolve(OutputData))
            const response = await request(server).get("/users")

            expect(response.status).toBe(200)
            expect(response.body).toStrictEqual(OutputData)
            expect(mockSearchUsersUseCase.execute).toBeCalledTimes(1)

        });

    });

})
