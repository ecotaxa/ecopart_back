//test/domain/repositories/user-repository.test.ts
import { UserDataSource } from "../../../src/data/interfaces/data-sources/user-data-source";
import { UserRequestModel, UserResponseModel } from "../../../src/domain/entities/user";
import { UserRepository } from "../../../src/domain/interfaces/repositories/user-repository";
import { UserRepositoryImpl } from "../../../src/domain/repositories/user-repository";

class MockUserDataSource implements UserDataSource {
    create(user: UserRequestModel): Promise<number> {
        throw new Error("Method not implemented.");
    }
    getAll(): Promise<UserResponseModel[]> {
        throw new Error("Method not implemented.");
    }
    getOne(): Promise<UserResponseModel> {
        throw new Error("Method not implemented.");
    }
}

describe("User Repository", () => {
    let mockUserDataSource: UserDataSource;
    let userRepository: UserRepository

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserDataSource = new MockUserDataSource()
        userRepository = new UserRepositoryImpl(mockUserDataSource)
    })

    describe("getAllUsers", () => {
        test("should return data", async () => {
            const expectedData = [{ id: 1, lastName: "Smith", firstName: "John", email: "john@gmail.com", status: "pending" }]
            jest.spyOn(mockUserDataSource, "getAll").mockImplementation(() => Promise.resolve(expectedData))
            const result = await userRepository.getUsers();
            expect(result).toBe(expectedData)
        });
    })

    describe("createUser", () => {
        test("should return true", async () => {
            const inputData = { lastName: "Smith", firstName: "John", email: "john@gmail.com", password: "123test!" }
            jest.spyOn(mockUserDataSource, "create").mockImplementation(() => Promise.resolve(1))
            const result = await userRepository.createUser(inputData);
            expect(result).toBe(1)
        });
    })

})