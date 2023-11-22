import { DecodedToken } from "../../../../src/domain/entities/auth";
import { UserResponseModel, UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { UpdateUser } from '../../../../src/domain/use-cases/user/update-user'

/* TESTED HERE */
// User is not admin : edit regular properties on himself : ok
// User is not admin : edit admin property on himself : nok
// user is not admin : edit someone else regular properties : nok
// user is not admin : edit someone else adminproperty : nok

// user is admin : edit regular properties on himself : ok
// user is admin : edit admin property on himself : ok
// user is admin : edit someone else regular properties : ok
// user is admin : edit someone else adminproperty : ok

describe("Update User Use Case", () => {
    class MockUserRepository implements UserRepository {
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
    test("User is not admin : edit regular properties on himself : ok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_update: UserUpdateModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "Joan"
        }
        const OutputData: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "Joan",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }

        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "adminUpdateUser")
        jest.spyOn(mockUserRepository, "standardUpdateUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputData))
        const updateUserUseCase = new UpdateUser(mockUserRepository)
        const result = await updateUserUseCase.execute(current_user, user_to_update);
        expect(result).toStrictEqual(OutputData);

        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).not.toBeCalled();
        expect(mockUserRepository.standardUpdateUser).toBeCalled();
        expect(mockUserRepository.getUser).toBeCalled();
    });

    test("User is not admin : edit admin property on himself : nok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_update: UserUpdateModel = {
            user_id: 1,
            status: "Active",
            is_admin: true
        }
        const getUserOutputData: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "Joan",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }

        const OutputError = new Error("Can't update user")

        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "adminUpdateUser")
        jest.spyOn(mockUserRepository, "standardUpdateUser").mockImplementation(() => Promise.resolve(0))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(getUserOutputData))

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_update);
            expect(true).toBe(false)
        } catch (err) {
            expect(err).toStrictEqual(OutputError);
        }

        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).not.toBeCalled();
        expect(mockUserRepository.standardUpdateUser).toBeCalled();
        expect(mockUserRepository.getUser).not.toBeCalled();

    });

    test("User is not admin : edit someone else regular properties : nok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_update: UserUpdateModel = {
            user_id: 2,
            last_name: "Smith",
            first_name: "Joan"
        }
        const getUserOutputData: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "Joan",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }

        const OutputError = new Error("Logged user cannot update this property or user")

        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "adminUpdateUser")
        jest.spyOn(mockUserRepository, "standardUpdateUser").mockImplementation(() => Promise.resolve(0))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(getUserOutputData))

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_update);
            expect(true).toBe(false)
        } catch (err) {
            expect(err).toStrictEqual(OutputError);
        }
        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).not.toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.getUser).not.toBeCalled();

    });


    test("User is not admin : edit someone else adminproperty : nok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_update: UserUpdateModel = {
            user_id: 2,
            status: "Active",
            is_admin: true
        }
        const getUserOutputData: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "Joan",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }

        const OutputError = new Error("Logged user cannot update this property or user")

        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "adminUpdateUser")
        jest.spyOn(mockUserRepository, "standardUpdateUser").mockImplementation(() => Promise.resolve(0))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(getUserOutputData))

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_update);
            expect(true).toBe(false)
        } catch (err) {
            expect(err).toStrictEqual(OutputError);
        }
        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).not.toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.getUser).not.toBeCalled();

    });






    // ADMIN 
    test("User is admin : edit regular properties on himself : ok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_update: UserUpdateModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "Joan"
        }
        const OutputData: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "Joan",
            email: "john@gmail.com",
            is_admin: true,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }

        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "adminUpdateUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "standardUpdateUser")
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputData))
        const updateUserUseCase = new UpdateUser(mockUserRepository)
        const result = await updateUserUseCase.execute(current_user, user_to_update);
        expect(result).toStrictEqual(OutputData);

        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.getUser).toBeCalled();
    });

    test("User is admin : edit admin property on himself : ok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_update: UserUpdateModel = {
            user_id: 1,
            status: "Active",
            is_admin: true
        }
        const OutputData: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "Joan",
            email: "john@gmail.com",
            is_admin: true,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }

        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "adminUpdateUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "standardUpdateUser")
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputData))
        const updateUserUseCase = new UpdateUser(mockUserRepository)
        const result = await updateUserUseCase.execute(current_user, user_to_update);
        expect(result).toStrictEqual(OutputData);

        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.getUser).toBeCalled();

    });

    test("User is admin : edit someone else regular properties : ok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_update: UserUpdateModel = {
            user_id: 2,
            last_name: "Smith",
            first_name: "Joan"
        }
        const OutputData: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "Joan",
            email: "john@gmail.com",
            is_admin: false,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }

        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "adminUpdateUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "standardUpdateUser")
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputData))
        const updateUserUseCase = new UpdateUser(mockUserRepository)
        const result = await updateUserUseCase.execute(current_user, user_to_update);
        expect(result).toStrictEqual(OutputData);

        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.getUser).toBeCalled();
    });


    test("User is admin : edit someone else adminproperty : ok", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_update: UserUpdateModel = {
            user_id: 2,
            status: "Active",
            is_admin: true
        }
        const OutputData: UserResponseModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "Joan",
            email: "john@gmail.com",
            is_admin: true,
            valid_email: true,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            user_creation_date: '2023-08-01 10:30:00'
        }

        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "adminUpdateUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "standardUpdateUser")
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputData))
        const updateUserUseCase = new UpdateUser(mockUserRepository)
        const result = await updateUserUseCase.execute(current_user, user_to_update);
        expect(result).toStrictEqual(OutputData);

        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.getUser).toBeCalled();

    });

    // others scenarios (for coverage)
    test("Can't find updated user", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_update: UserUpdateModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "Joan"
        }

        const OutputError = new Error("Can't find updated user")

        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "adminUpdateUser")
        jest.spyOn(mockUserRepository, "standardUpdateUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(null))

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_update);
            expect(true).toBe(false)
        } catch (err) {
            expect(err).toStrictEqual(OutputError);
        }
        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).not.toBeCalled();
        expect(mockUserRepository.standardUpdateUser).toBeCalled();
        expect(mockUserRepository.getUser).toBeCalled();

    });
    test("nothing to update on an admin user", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_update: UserUpdateModel = {
            user_id: 1,
            status: "Active",
            is_admin: true
        }

        const OutputError = new Error("Can't update user")

        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "adminUpdateUser").mockImplementation(() => Promise.resolve(0))
        jest.spyOn(mockUserRepository, "standardUpdateUser")
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(null))

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_update);
            expect(true).toBe(false)
        } catch (err) {
            expect(err).toStrictEqual(OutputError);
        }
        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.getUser).not.toBeCalled();

    });


})