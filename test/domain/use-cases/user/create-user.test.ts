import { UserRequestModel, UserResponseModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { CreateUser } from '../../../../src/domain/use-cases/user/create-user'

describe("Create User Use Case", () => {
    class MockUserRepository implements UserRepository {
        createUser(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        getUsers(): Promise<UserResponseModel[]> {
            throw new Error("Method not implemented.");
        }
        getUser(): Promise<UserResponseModel | null> {
            throw new Error("Method not implemented.");
        }
    }

    let mockUserRepository: UserRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository()
    })

    test("should return created user", async () => {
        const InputData: UserRequestModel = {
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

        jest.spyOn(mockUserRepository, "createUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputData))
        const createUserUseCase = new CreateUser(mockUserRepository)
        const result = await createUserUseCase.execute(InputData);
        expect(result).toStrictEqual(OutputData);
    });

})