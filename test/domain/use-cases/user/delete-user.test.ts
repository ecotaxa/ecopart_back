import { DecodedToken } from "../../../../src/domain/entities/auth";
import { SearchResult } from "../../../../src/domain/entities/search";
import { UserResponseModel, UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { DeleteUser } from '../../../../src/domain/use-cases/user/delete-user'

describe("Delete User Use Case", () => {
    class MockUserRepository implements UserRepository {
        adminGetUsers(): Promise<SearchResult<UserResponseModel>> {
            throw new Error("Method not implemented.");
        }
        standardGetUsers(): Promise<SearchResult<UserResponseModel>> {
            throw new Error("Method not implemented.");
        }
        deleteUser(): Promise<number> {
            throw new Error("Method not implemented.");
        }
        isDeleted(): Promise<boolean> {
            throw new Error("Method not implemented.");
        }
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


    // NOT ADMIN
    test("User is not admin : delete himself : ok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_delete: UserUpdateModel = {
            user_id: 1
        }
        const preexisant_user: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            valid_email: true,
            is_admin: false,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00',
        }



        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(preexisant_user))
        jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "deleteUser").mockImplementation(() => Promise.resolve(1))

        const updateUserUseCase = new DeleteUser(mockUserRepository)
        await updateUserUseCase.execute(current_user, user_to_delete);

        expect(mockUserRepository.getUser).toBeCalledWith(user_to_delete);
        expect(mockUserRepository.isDeleted).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.deleteUser).toBeCalledWith(user_to_delete);
    });



    test("User is not admin : delete someone else : nok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_delete: UserUpdateModel = {
            user_id: 2
        }
        const preexisant_user: UserResponseModel = {
            user_id: 2,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            valid_email: true,
            is_admin: false,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00',
        }



        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(preexisant_user))
        jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "deleteUser").mockImplementation(() => Promise.resolve(1))

        const updateUserUseCase = new DeleteUser(mockUserRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_delete);
        } catch (err) {
            expect(err.message).toBe("Logged user cannot delet this user");
        }
        expect(mockUserRepository.getUser).toBeCalledWith(user_to_delete);
        expect(mockUserRepository.isDeleted).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.deleteUser).not.toBeCalled();
    });



    // ADMIN 
    test("User is admin : delete himself : ok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_delete: UserUpdateModel = {
            user_id: 1
        }
        const preexisant_user: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            valid_email: true,
            is_admin: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00',
        }



        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(preexisant_user))
        jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "deleteUser").mockImplementation(() => Promise.resolve(1))

        const updateUserUseCase = new DeleteUser(mockUserRepository)
        await updateUserUseCase.execute(current_user, user_to_delete);

        expect(mockUserRepository.getUser).toBeCalledWith(user_to_delete);
        expect(mockUserRepository.isDeleted).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.deleteUser).toBeCalledWith(user_to_delete);

    });

    test("User is admin : delete someone else : ok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_delete: UserUpdateModel = {
            user_id: 2
        }
        const preexisant_user: UserResponseModel = {
            user_id: 2,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            valid_email: true,
            is_admin: false,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00',
        }



        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(preexisant_user))
        jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "deleteUser").mockImplementation(() => Promise.resolve(1))

        const updateUserUseCase = new DeleteUser(mockUserRepository)
        await updateUserUseCase.execute(current_user, user_to_delete);

        expect(mockUserRepository.getUser).toBeCalledWith(user_to_delete);
        expect(mockUserRepository.isDeleted).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.deleteUser).toBeCalledWith(user_to_delete);
    });

    // Other failing scenarios
    test("Can't find user to delete", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_delete: UserUpdateModel = {
            user_id: 2
        }

        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(null))
        jest.spyOn(mockUserRepository, "isDeleted")
        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockUserRepository, "deleteUser")

        const updateUserUseCase = new DeleteUser(mockUserRepository)

        try {
            await updateUserUseCase.execute(current_user, user_to_delete);
        } catch (err) {
            expect(err.message).toBe("Can't find user to delete");
        }

        expect(mockUserRepository.getUser).toBeCalledWith(user_to_delete);
        expect(mockUserRepository.isDeleted).not.toBeCalled();
        expect(mockUserRepository.isAdmin).not.toBeCalled();
        expect(mockUserRepository.deleteUser).not.toBeCalled();
    });

    test("User to delete is already deleted", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_delete: UserUpdateModel = {
            user_id: 2
        }
        const preexisant_user: UserResponseModel = {
            user_id: 2,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            valid_email: true,
            is_admin: false,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00',
            deleted: '2023-08-01 10:31:00',
        }

        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(preexisant_user))
        jest.spyOn(mockUserRepository, "isDeleted")
        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockUserRepository, "deleteUser")

        const updateUserUseCase = new DeleteUser(mockUserRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_delete);
        } catch (err) {
            expect(err.message).toBe("User is deleted");
        }


        expect(mockUserRepository.getUser).toBeCalledWith(user_to_delete);
        expect(mockUserRepository.isDeleted).not.toBeCalled();
        expect(mockUserRepository.isAdmin).not.toBeCalled();
        expect(mockUserRepository.deleteUser).not.toBeCalled();
    });

    test("Current user is deleted", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_delete: UserUpdateModel = {
            user_id: 2
        }
        const preexisant_user: UserResponseModel = {
            user_id: 2,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            valid_email: true,
            is_admin: false,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00',
        }

        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(preexisant_user))
        jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockUserRepository, "deleteUser")

        const updateUserUseCase = new DeleteUser(mockUserRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_delete);
        } catch (err) {
            expect(err.message).toBe("User is deleted");
        }


        expect(mockUserRepository.getUser).toBeCalledWith(user_to_delete);
        expect(mockUserRepository.isDeleted).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).not.toBeCalled();
        expect(mockUserRepository.deleteUser).not.toBeCalled();
    });

    test("Can't delete user", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_delete: UserUpdateModel = {
            user_id: 2
        }
        const preexisant_user: UserResponseModel = {
            user_id: 2,
            last_name: "Smith",
            first_name: "John",
            email: "john@gmail.com",
            valid_email: true,
            is_admin: false,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00',
        }

        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(preexisant_user))
        jest.spyOn(mockUserRepository, "isDeleted").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "deleteUser").mockImplementation(() => Promise.resolve(0))

        const updateUserUseCase = new DeleteUser(mockUserRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_delete);
        } catch (err) {
            expect(err.message).toBe("Can't delete user");
        }
        expect(mockUserRepository.getUser).toBeCalledWith(user_to_delete);
        expect(mockUserRepository.isDeleted).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.deleteUser).toBeCalledWith(user_to_delete);
    });


})