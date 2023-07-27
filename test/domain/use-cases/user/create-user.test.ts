import { UserRequestModel, UserResponseModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { CreateUser } from '../../../../src/domain/use-cases/user/create-user'

describe("Create User Use Case", () => {
    class MockUserRepository implements UserRepository {
        createUser(user: UserRequestModel): Promise<number> {
            throw new Error("Method not implemented.");
        }
        getUsers(): Promise<UserResponseModel[]> {
            throw new Error("Method not implemented.");
        }
        getUser(id: number): Promise<UserResponseModel | null> {
            throw new Error("Method not implemented.");
        }
    }

    let mockUserRepository: UserRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository()
    })

    test("should return true", async () => {
        const InputData = { lastName: "Smith", firstName: "John", email: "john@gmail.com", password: "test123!" }
        const OutputData = { id: 1, lastName: "Smith", firstName: "John", email: "john@gmail.com", status: "pending" }
        jest.spyOn(mockUserRepository, "createUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputData))
        const createUserUseCase = new CreateUser(mockUserRepository)
        const result = await createUserUseCase.execute(InputData);
        expect(result).toStrictEqual(OutputData);
    });

})