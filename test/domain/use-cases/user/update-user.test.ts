import { UserResponseModel, UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { UpdateUser } from '../../../../src/domain/use-cases/user/update-user'
import { MockUserRepository } from "../../../mocks/user-mock";

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

    let mockUserRepository: UserRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository()
    })

    test("Current user cannot be used", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_update: UserUpdateModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "Joan"
        }

        const OutputError = new Error("User cannot be used")

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(OutputError))
        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockUserRepository, "adminUpdateUser")
        jest.spyOn(mockUserRepository, "standardUpdateUser")
        jest.spyOn(mockUserRepository, "getUser")
        jest.spyOn(mockUserRepository, "toPublicUser")

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_update);
            expect(true).toBe(false)
        } catch (err) {
            expect(err).toStrictEqual(OutputError);
        }

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1);
        expect(mockUserRepository.isAdmin).not.toBeCalled();
        expect(mockUserRepository.adminUpdateUser).not.toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.getUser).not.toBeCalled();
        expect(mockUserRepository.toPublicUser).not.toBeCalled();
    });

    test("User to update don't exist", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_update: UserUpdateModel = {
            user_id: 1,
            last_name: "Smith",
            first_name: "Joan"
        }

        const OutputError = new Error("Cannot find user to update")
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(null))

        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockUserRepository, "adminUpdateUser")
        jest.spyOn(mockUserRepository, "standardUpdateUser")
        jest.spyOn(mockUserRepository, "toPublicUser")

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_update);
            expect(true).toBe(false)
        } catch (err) {
            expect(err).toStrictEqual(OutputError);
        }

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1);
        expect(mockUserRepository.getUser).toBeCalledTimes(1);

        expect(mockUserRepository.isAdmin).not.toBeCalled();
        expect(mockUserRepository.adminUpdateUser).not.toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.toPublicUser).not.toBeCalled();
    });
    test("User to update is deleted", async () => {
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
            user_creation_date: '2023-08-01 10:30:00',
            deleted: '2023-08-01 10:30:00'
        }

        const OutputError = new Error("User to update is deleted")

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputData))

        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockUserRepository, "adminUpdateUser")
        jest.spyOn(mockUserRepository, "standardUpdateUser")
        jest.spyOn(mockUserRepository, "toPublicUser")

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_update);
            expect(true).toBe(false)
        } catch (err) {
            expect(err).toStrictEqual(OutputError);
        }

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1);
        expect(mockUserRepository.getUser).toBeCalledTimes(1);
        expect(mockUserRepository.isAdmin).not.toBeCalled();
        expect(mockUserRepository.adminUpdateUser).not.toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.toPublicUser).not.toBeCalled();
    });

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

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "adminUpdateUser")
        jest.spyOn(mockUserRepository, "standardUpdateUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputData))
        jest.spyOn(mockUserRepository, "toPublicUser").mockImplementation(() => OutputData)

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        const result = await updateUserUseCase.execute(current_user, user_to_update);
        expect(result).toStrictEqual(OutputData);

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1);
        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).not.toBeCalled();
        expect(mockUserRepository.standardUpdateUser).toBeCalled();
        expect(mockUserRepository.getUser).toBeCalled();
        expect(mockUserRepository.toPublicUser).toBeCalled();
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

        const OutputError = new Error("Cannot update user")

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "adminUpdateUser")
        jest.spyOn(mockUserRepository, "standardUpdateUser").mockImplementation(() => Promise.resolve(0))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(getUserOutputData))
        jest.spyOn(mockUserRepository, "toPublicUser")

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_update);
            expect(true).toBe(false)
        } catch (err) {
            expect(err).toStrictEqual(OutputError);
        }

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1);
        expect(mockUserRepository.getUser).toBeCalledTimes(1);
        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).not.toBeCalled();
        expect(mockUserRepository.standardUpdateUser).toBeCalled();
        expect(mockUserRepository.toPublicUser).not.toBeCalled();

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
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "adminUpdateUser")
        jest.spyOn(mockUserRepository, "standardUpdateUser").mockImplementation(() => Promise.resolve(0))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(getUserOutputData))
        jest.spyOn(mockUserRepository, "toPublicUser")

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_update);
            expect(true).toBe(false)
        } catch (err) {
            expect(err).toStrictEqual(OutputError);
        }
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1);
        expect(mockUserRepository.getUser).toBeCalled();
        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).not.toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.toPublicUser).not.toBeCalled();

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
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "adminUpdateUser")
        jest.spyOn(mockUserRepository, "standardUpdateUser").mockImplementation(() => Promise.resolve(0))
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(getUserOutputData))
        jest.spyOn(mockUserRepository, "toPublicUser")

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_update);
            expect(true).toBe(false)
        } catch (err) {
            expect(err).toStrictEqual(OutputError);
        }
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1);
        expect(mockUserRepository.getUser).toBeCalled();
        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).not.toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.toPublicUser).not.toBeCalled();

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
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "adminUpdateUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "standardUpdateUser")
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputData))
        jest.spyOn(mockUserRepository, "toPublicUser").mockImplementation(() => OutputData)

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        const result = await updateUserUseCase.execute(current_user, user_to_update);
        expect(result).toStrictEqual(OutputData);

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1);
        expect(mockUserRepository.getUser).toBeCalledTimes(2);
        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.toPublicUser).toBeCalled();

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
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "adminUpdateUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "standardUpdateUser")
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputData))
        jest.spyOn(mockUserRepository, "toPublicUser").mockImplementation(() => OutputData)

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        const result = await updateUserUseCase.execute(current_user, user_to_update);
        expect(result).toStrictEqual(OutputData);

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1);
        expect(mockUserRepository.getUser).toBeCalledTimes(2);
        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.toPublicUser).toBeCalled();
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
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "adminUpdateUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "standardUpdateUser")
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputData))
        jest.spyOn(mockUserRepository, "toPublicUser").mockImplementation(() => OutputData)

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        const result = await updateUserUseCase.execute(current_user, user_to_update);
        expect(result).toStrictEqual(OutputData);

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1);
        expect(mockUserRepository.getUser).toBeCalledTimes(2);
        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.toPublicUser).toBeCalled();
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
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "adminUpdateUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "standardUpdateUser")
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(OutputData))
        jest.spyOn(mockUserRepository, "toPublicUser").mockImplementation(() => OutputData)

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        const result = await updateUserUseCase.execute(current_user, user_to_update);
        expect(result).toStrictEqual(OutputData);

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1);
        expect(mockUserRepository.getUser).toBeCalledTimes(2);
        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.toPublicUser).toBeCalled();

    });

    // others scenarios 
    test("Cannot find updated user", async () => {
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

        const OutputError = new Error("Cannot find updated user")

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(OutputData)).mockImplementationOnce(() => Promise.resolve(null))
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "adminUpdateUser")
        jest.spyOn(mockUserRepository, "standardUpdateUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockUserRepository, "toPublicUser")


        const updateUserUseCase = new UpdateUser(mockUserRepository)

        try {
            await updateUserUseCase.execute(current_user, user_to_update);
            expect(true).toBe(false)
        } catch (err) {
            expect(err).toStrictEqual(OutputError);
        }

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1);
        expect(mockUserRepository.getUser).toBeCalledTimes(2);
        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.adminUpdateUser).not.toBeCalled();
        expect(mockUserRepository.standardUpdateUser).toBeCalled();
        expect(mockUserRepository.toPublicUser).not.toBeCalled();


    });
    test("Nothing to update on an admin user", async () => {
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

        const OutputError = new Error("Cannot update user")

        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "adminUpdateUser").mockImplementation(() => Promise.resolve(0))
        jest.spyOn(mockUserRepository, "standardUpdateUser")
        jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(OutputData)).mockImplementationOnce(() => Promise.resolve(null))
        jest.spyOn(mockUserRepository, "toPublicUser")

        const updateUserUseCase = new UpdateUser(mockUserRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_update);
            expect(true).toBe(false)
        } catch (err) {
            expect(err).toStrictEqual(OutputError);
        }
        expect(mockUserRepository.isAdmin).toBeCalled();
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1);
        expect(mockUserRepository.adminUpdateUser).toBeCalled();
        expect(mockUserRepository.standardUpdateUser).not.toBeCalled();
        expect(mockUserRepository.getUser).toBeCalledTimes(1);
        expect(mockUserRepository.toPublicUser).not.toBeCalled();
    });
})
