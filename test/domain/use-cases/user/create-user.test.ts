import { DecodedToken } from "../../../../src/domain/entities/auth";
import { UserRequesCreationtModel, UserResponseModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { CreateUser } from '../../../../src/domain/use-cases/user/create-user'

describe("Create User Use Case", () => {
    class MockUserRepository implements UserRepository {
        adminUpdateUser(): Promise<number | null> {
            throw new Error("Method not implemented.");
        }
        standardUpdateUser(): Promise<number | null> {
            throw new Error("Method not implemented.");
        }
        isAdmin(): Promise<boolean> {
            throw new Error("Method not implemented.");
        }
        createUser(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        getUsers(): Promise<UserResponseModel[]> {
            throw new Error("Method not implemented.");
        }
        getUser(): Promise<UserResponseModel | null> {
            throw new Error("Method not implemented.");
        }
        verifyUserLogin(): Promise<boolean> {
            throw new Error("Method not implemented.");
        }
        validUser(): Promise<number | null> {
            throw new Error("Method not implemented.");
        }
        generateValidationToken(): string {
            throw new Error("Method not implemented.");
        }
        verifyValidationToken(): DecodedToken | null {
            throw new Error("Method not implemented.");
        }
    }

    let mockUserRepository: UserRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository()
    })

    test("should return created user", async () => {
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

        jest.spyOn(mockUserRepository, "createUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputData))
        const createUserUseCase = new CreateUser(mockUserRepository)
        const result = await createUserUseCase.execute(InputData);
        expect(result).toStrictEqual(OutputData);
    });

    test("Try to add a user that already exist", async () => {
        const InputData: UserRequesCreationtModel = {
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            password: "test123!",
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        };
        const OutputData = new Error("Can't create user")

        jest.spyOn(mockUserRepository, "createUser").mockImplementation(() => Promise.resolve(null));
        const createUserUseCase = new CreateUser(mockUserRepository);
        try {
            await createUserUseCase.execute(InputData);
            expect(true).toBe(false)
        } catch (err) {

            expect(err).toStrictEqual(OutputData);
        }
    });
    test("Can't find created user", async () => {
        const InputData: UserRequesCreationtModel = {
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            password: "test123!",
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        };
        const OutputData = new Error("Can't find created user")


        jest.spyOn(mockUserRepository, "createUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(null))
        const createUserUseCase = new CreateUser(mockUserRepository);
        try {
            await createUserUseCase.execute(InputData);
            expect(true).toBe(false)
        } catch (err) {

            expect(err).toStrictEqual(OutputData);
        }
    });

})