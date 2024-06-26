import { UserResponseModel, UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { DeleteUser } from '../../../../src/domain/use-cases/user/delete-user'
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";

describe("Delete User Use Case", () => {

    let mockUserRepository: UserRepository;
    let mockPrivilegeRepository: PrivilegeRepository

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository()
        mockPrivilegeRepository = new MockPrivilegeRepository()
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
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "deleteUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockPrivilegeRepository, "deletePrivileges").mockImplementation(() => Promise.resolve(1))

        const updateUserUseCase = new DeleteUser(mockUserRepository, mockPrivilegeRepository)
        await updateUserUseCase.execute(current_user, user_to_delete);

        expect(mockUserRepository.getUser).toBeCalledWith(user_to_delete);
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
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
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
        jest.spyOn(mockUserRepository, "deleteUser").mockImplementation(() => Promise.resolve(1))

        const updateUserUseCase = new DeleteUser(mockUserRepository, mockPrivilegeRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_delete);
        } catch (err) {
            expect(err.message).toBe("Logged user cannot delet this user");
        }
        expect(mockUserRepository.getUser).toBeCalledWith(user_to_delete);
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
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
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "deleteUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockPrivilegeRepository, "deletePrivileges").mockImplementation(() => Promise.resolve(1))

        const updateUserUseCase = new DeleteUser(mockUserRepository, mockPrivilegeRepository)
        await updateUserUseCase.execute(current_user, user_to_delete);

        expect(mockUserRepository.getUser).toBeCalledWith(user_to_delete);
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.deleteUser).toBeCalledWith(user_to_delete);
        expect(mockPrivilegeRepository.deletePrivileges).toBeCalledWith(user_to_delete);

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
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "deleteUser").mockImplementation(() => Promise.resolve(1))
        jest.spyOn(mockPrivilegeRepository, "deletePrivileges").mockImplementation(() => Promise.resolve(1))

        const updateUserUseCase = new DeleteUser(mockUserRepository, mockPrivilegeRepository)
        await updateUserUseCase.execute(current_user, user_to_delete);

        expect(mockUserRepository.getUser).toBeCalledWith(user_to_delete);
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.deleteUser).toBeCalledWith(user_to_delete);
        expect(mockPrivilegeRepository.deletePrivileges).toBeCalledWith(user_to_delete);
    });

    // Other failing scenarios
    test("Cannot find user to delete", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_delete: UserUpdateModel = {
            user_id: 2
        }

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(null))
        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockUserRepository, "deleteUser")

        const updateUserUseCase = new DeleteUser(mockUserRepository, mockPrivilegeRepository)

        try {
            await updateUserUseCase.execute(current_user, user_to_delete);
        } catch (err) {
            expect(err.message).toBe("Cannot find user to delete");
        }

        expect(mockUserRepository.getUser).toBeCalledWith(user_to_delete);
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1);
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

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(() => Promise.resolve(preexisant_user))
        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockUserRepository, "deleteUser")

        const updateUserUseCase = new DeleteUser(mockUserRepository, mockPrivilegeRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_delete);
        } catch (err) {
            expect(err.message).toBe("User is deleted");
        }

        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1);
        expect(mockUserRepository.getUser).toBeCalledWith(user_to_delete);
        expect(mockUserRepository.isAdmin).not.toBeCalled();
        expect(mockUserRepository.deleteUser).not.toBeCalled();
    });

    test("Current user is deleted or invalid", async () => {
        const current_user: UserUpdateModel = {
            user_id: 1
        }
        const user_to_delete: UserUpdateModel = {
            user_id: 2
        }

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(new Error("User cannot be used")))
        jest.spyOn(mockUserRepository, "getUser")
        jest.spyOn(mockUserRepository, "isAdmin")
        jest.spyOn(mockUserRepository, "deleteUser")

        const updateUserUseCase = new DeleteUser(mockUserRepository, mockPrivilegeRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_delete);
        } catch (err) {
            expect(err.message).toBe("User cannot be used");
        }


        expect(mockUserRepository.getUser).not.toBeCalled();
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).not.toBeCalled();
        expect(mockUserRepository.deleteUser).not.toBeCalled();
    });

    test("Cannot delete user", async () => {
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
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true))
        jest.spyOn(mockUserRepository, "deleteUser").mockImplementation(() => Promise.resolve(0))

        const updateUserUseCase = new DeleteUser(mockUserRepository, mockPrivilegeRepository)
        try {
            await updateUserUseCase.execute(current_user, user_to_delete);
        } catch (err) {
            expect(err.message).toBe("Cannot delete user");
        }
        expect(mockUserRepository.getUser).toBeCalledWith(user_to_delete);
        expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
        expect(mockUserRepository.deleteUser).toBeCalledWith(user_to_delete);
    });


})