import { UserRequestModel, UserResponseModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { GetAllUsers } from '../../../../src/domain/use-cases/user/get-all-users'

describe("Get All Users Use Case", () => {

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

    test("should return data", async () => {
        const ExpectedResult = [{
            id: 1,
            lastName: "Smith",
            firstName: "John",
            email: "john@gmail.com",
            status: "Pending",
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }]

        jest.spyOn(mockUserRepository, "getUsers").mockImplementation(() => Promise.resolve(ExpectedResult))
        const getAllUsersUse = new GetAllUsers(mockUserRepository)
        const result = await getAllUsersUse.execute();
        expect(result).toStrictEqual(ExpectedResult)

    });

})