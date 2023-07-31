import request from "supertest";
import { UserResponseModel, UserRequestModel } from "../../../src/domain/entities/user";
import { CreateUserUseCase } from "../../../src/domain/interfaces/use-cases/user/create-user";
import { GetAllUsersUseCase } from "../../../src/domain/interfaces/use-cases/user/get-all-users";
import UserRouter from '../../../src/presentation/routers/user-router'
import server from '../../../src/server'

class MockGetAllUsersUseCase implements GetAllUsersUseCase {
    execute(): Promise<UserResponseModel[]> {
        throw new Error("Method not implemented.")
    }
}

class MockCreateUserUseCase implements CreateUserUseCase {
    execute(user: UserRequestModel): Promise<UserResponseModel> {
        throw new Error("Method not implemented.")
    }
}

describe("User Router", () => {
    let mockCreateUserUseCase: CreateUserUseCase;
    let mockGetAllUsersUseCase: GetAllUsersUseCase;

    beforeAll(() => {
        mockGetAllUsersUseCase = new MockGetAllUsersUseCase()
        mockCreateUserUseCase = new MockCreateUserUseCase()
        server.use("/user", UserRouter(mockGetAllUsersUseCase, mockCreateUserUseCase))
    })

    beforeEach(() => {
        jest.clearAllMocks();
    })

    describe("GET /user", () => {

        test("should return 200 with data", async () => {
            const ExpectedData = [{
                id: 1,
                lastName: "Smith",
                firstName: "John",
                email: "john@gmail.com",
                status: "Pending",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_date: '2023-08-01 10:30:00'
            }];
            jest.spyOn(mockGetAllUsersUseCase, "execute").mockImplementation(() => Promise.resolve(ExpectedData))

            const response = await request(server).get("/user")

            expect(response.status).toBe(200)
            expect(mockGetAllUsersUseCase.execute).toBeCalledTimes(1)
            expect(response.body).toStrictEqual(ExpectedData)

        });

        test("GET /user returns 500 on use case error", async () => {
            jest.spyOn(mockGetAllUsersUseCase, "execute").mockImplementation(() => Promise.reject(Error()))
            const response = await request(server).get("/user")
            expect(response.status).toBe(500)
            expect(response.body).toStrictEqual({ message: "Error fetching data" })
        });
    })

    describe("POST /user", () => {

        test("POST /user", async () => {
            const InputData = {
                lastName: "Smith",
                firstName: "John",
                email: "john@gmail.com",
                password: "test123!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            const OutputData = {
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
            const response = await request(server).post("/user").send(InputData)
            expect(response.status).toBe(201)
        });

        test("POST /user returns 500 on use case error", async () => {
            const InputData = {
                lastName: "Smith",
                firstName: "John",
                email: "john@gmail.com",
                password: "test123!",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
            }
            jest.spyOn(mockCreateUserUseCase, "execute").mockImplementation(() => Promise.reject(Error()))
            const response = await request(server).post("/user").send(InputData)
            expect(response.status).toBe(500)
        });
    })

})