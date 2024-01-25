import { DecodedToken } from "../../../../src/domain/entities/auth";
import { UserResponseModel, } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { GetAllUsers } from '../../../../src/domain/use-cases/user/get-all-users'

describe("Get All Users Use Case", () => {

    class MockUserRepository implements UserRepository {
        generateResetPasswordToken(): string {
            throw new Error("Method not implemented.");
        }
        verifyResetPasswordToken(): DecodedToken | null {
            throw new Error("Method not implemented.");
        }
        setResetPasswordCode(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        toPublicUser(): UserResponseModel {
            throw new Error("Method not implemented.");
        }
        changePassword(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        adminUpdateUser(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        standardUpdateUser(): Promise<number> {
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
        validUser(): Promise<number> {
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
    // TODO TEST when non user
    test("Should return data", async () => {
        const ExpectedResult: UserResponseModel = {
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

        jest.spyOn(mockUserRepository, "getUsers").mockImplementation(() => Promise.resolve([ExpectedResult]))
        jest.spyOn(mockUserRepository, "toPublicUser").mockImplementation(() => { return ExpectedResult })
        const getAllUsersUse = new GetAllUsers(mockUserRepository)
        const result = await getAllUsersUse.execute();
        expect(result).toStrictEqual([ExpectedResult])

    });
})