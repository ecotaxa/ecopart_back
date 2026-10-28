import { DecodedToken } from "../../../../src/domain/entities/auth";
import { UserResponseModel, } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { ValidUser } from '../../../../src/domain/use-cases/user/valid-user'
import { MockUserRepository } from "../../../mocks/user-mock";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { projectResponseModel } from "../../../entities/project";

describe("Valid Users Use Case", () => {

    let mockUserRepository: UserRepository;
    let mockProjectRepository: ProjectRepository;
    let mockPrivilegeRepository: PrivilegeRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository()
        mockProjectRepository = new MockProjectRepository()
        mockPrivilegeRepository = new MockPrivilegeRepository()
    })
    describe("Nominal case", () => {
        test("User is validated", async () => {

            const user_id = 1
            const confirmation_token = "token"

            const decoded_token: DecodedToken = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const user_to_update: UserResponseModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00'
            }
            const updated_user: UserResponseModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                confirmation_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00'
            }


            jest.spyOn(mockUserRepository, "verifyValidationToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(user_to_update)).mockImplementationOnce(() => Promise.resolve(updated_user))
            jest.spyOn(mockUserRepository, "validUser").mockImplementation(() => Promise.resolve(1))
            jest.spyOn(mockProjectRepository, "listProjects").mockResolvedValue([])
            jest.spyOn(mockPrivilegeRepository, "addPrivilege")

            const getAllUsersUse = new ValidUser(mockUserRepository, mockProjectRepository, mockPrivilegeRepository)

            try {
                await getAllUsersUse.execute(user_id, confirmation_token);
            } catch (e) {
                console.log(e.message)
                expect(true).toBe(false)
            }
            expect(mockUserRepository.verifyValidationToken).toHaveBeenCalledWith(confirmation_token);
            expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { user_id: user_id, confirmation_code: decoded_token.confirmation_code });
            expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(2, { user_id: user_to_update.user_id });
            expect(mockUserRepository.validUser).toHaveBeenCalledWith({ user_id: user_to_update.user_id });
            expect(mockProjectRepository.listProjects).toBeCalledTimes(1);
            expect(mockPrivilegeRepository.addPrivilege).toBeCalledTimes(0);
        });
    })

    describe("Joining the projects naming the validated email", () => {
        const user_id = 7
        const email = "jane@lov.fr"
        const validated_user: UserResponseModel = {
            user_id: user_id,
            last_name: "Doe",
            first_name: "Jane",
            email: email,
            is_admin: false,
            valid_email: true,
            confirmation_code: null,
            organisation: "LOV",
            country: "France",
            user_planned_usage: "Lorem ipsum",
            user_creation_utc_date_time: '2023-08-01 10:30:00'
        }
        const project = (project_id: number, data_owner_email: string, operator_email: string, chief_scientist_email: string) =>
            ({ ...projectResponseModel, project_id, data_owner_email, operator_email, chief_scientist_email })

        beforeEach(() => {
            jest.spyOn(mockUserRepository, "verifyValidationToken").mockReturnValue({ ...validated_user, valid_email: false, confirmation_code: "code", iat: 1, exp: 2 })
            jest.spyOn(mockUserRepository, "getUser")
                .mockResolvedValueOnce({ ...validated_user, valid_email: false, confirmation_code: "code" })
                .mockResolvedValueOnce(validated_user)
            jest.spyOn(mockUserRepository, "validUser").mockResolvedValue(1)
        })

        test("Data owner and chief scientist become manager, operator becomes member", async () => {
            jest.spyOn(mockProjectRepository, "listProjects").mockResolvedValue([
                project(1, " Jane@LOV.fr ", "other@lov.fr", "other@lov.fr"),
                project(2, "other@lov.fr", "other@lov.fr", email),
                project(3, "other@lov.fr", email, "other@lov.fr"),
                project(4, "other@lov.fr", email, email),
                project(5, "other@lov.fr", "other@lov.fr", "other@lov.fr"),
            ])
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(false)
            jest.spyOn(mockPrivilegeRepository, "addPrivilege").mockResolvedValue(1)

            await new ValidUser(mockUserRepository, mockProjectRepository, mockPrivilegeRepository).execute(user_id, "token")

            expect(mockPrivilegeRepository.addPrivilege).toBeCalledTimes(4)
            expect(mockPrivilegeRepository.addPrivilege).toBeCalledWith({ user_id, project_id: 1, privilege_name: "manager", contact: false })
            expect(mockPrivilegeRepository.addPrivilege).toBeCalledWith({ user_id, project_id: 2, privilege_name: "manager", contact: false })
            expect(mockPrivilegeRepository.addPrivilege).toBeCalledWith({ user_id, project_id: 3, privilege_name: "member", contact: false })
            expect(mockPrivilegeRepository.addPrivilege).toBeCalledWith({ user_id, project_id: 4, privilege_name: "manager", contact: false })
            expect(mockPrivilegeRepository.isGranted).not.toBeCalledWith({ user_id, project_id: 5 })
        });

        test("A project where the user already has a privilege is left as is", async () => {
            jest.spyOn(mockProjectRepository, "listProjects").mockResolvedValue([project(1, email, "other@lov.fr", "other@lov.fr")])
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(true)
            jest.spyOn(mockPrivilegeRepository, "addPrivilege")

            await new ValidUser(mockUserRepository, mockProjectRepository, mockPrivilegeRepository).execute(user_id, "token")

            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id, project_id: 1 })
            expect(mockPrivilegeRepository.addPrivilege).toBeCalledTimes(0)
        });

        test("A failure to join one project neither stops the others nor fails the validation", async () => {
            jest.spyOn(mockProjectRepository, "listProjects").mockResolvedValue([
                project(1, email, "other@lov.fr", "other@lov.fr"),
                project(2, "other@lov.fr", email, "other@lov.fr"),
            ])
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(false)
            jest.spyOn(mockPrivilegeRepository, "addPrivilege").mockRejectedValueOnce(new Error("db error")).mockResolvedValueOnce(1)
            jest.spyOn(console, "error").mockImplementation(() => undefined)

            await new ValidUser(mockUserRepository, mockProjectRepository, mockPrivilegeRepository).execute(user_id, "token")

            expect(mockPrivilegeRepository.addPrivilege).toBeCalledTimes(2)
            expect(mockPrivilegeRepository.addPrivilege).toHaveBeenLastCalledWith({ user_id, project_id: 2, privilege_name: "member", contact: false })
        });

        test("A failure to list the projects does not fail the validation", async () => {
            jest.spyOn(mockProjectRepository, "listProjects").mockRejectedValue(new Error("db error"))
            jest.spyOn(mockPrivilegeRepository, "addPrivilege")
            jest.spyOn(console, "error").mockImplementation(() => undefined)

            await new ValidUser(mockUserRepository, mockProjectRepository, mockPrivilegeRepository).execute(user_id, "token")

            expect(mockUserRepository.validUser).toBeCalledWith({ user_id })
            expect(mockPrivilegeRepository.addPrivilege).toBeCalledTimes(0)
        });
    })

    describe("Error cases", () => {
        test("Invalid confirmation token", async () => {

            const user_id = 1
            const confirmation_token = "token"

            const decoded_token = null
            const user_to_update: UserResponseModel = {
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00'
            }
            const updated_user: UserResponseModel = {
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                confirmation_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00'
            }


            jest.spyOn(mockUserRepository, "verifyValidationToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(user_to_update)).mockImplementationOnce(() => Promise.resolve(updated_user))
            jest.spyOn(mockUserRepository, "validUser").mockImplementation(() => Promise.resolve(1))

            const getAllUsersUse = new ValidUser(mockUserRepository, mockProjectRepository, mockPrivilegeRepository)

            try {
                await getAllUsersUse.execute(user_id, confirmation_token);
                expect(true).toBe(false)
            } catch (e) {
                expect(mockUserRepository.verifyValidationToken).toHaveBeenCalledWith(confirmation_token);
                expect(mockUserRepository.getUser).not.toBeCalled();
                expect(mockUserRepository.validUser).not.toBeCalled();
                expect(e.message).toBe("Invalid confirmation token")
            }
        });

        test("Cross user vallidation forbidden", async () => {

            const user_id = 1
            const confirmation_token = "token"

            const decoded_token: DecodedToken = {
                user_id: 2,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const user_to_update: UserResponseModel = {
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00'
            }
            const updated_user: UserResponseModel = {
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                confirmation_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00'
            }


            jest.spyOn(mockUserRepository, "verifyValidationToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(user_to_update)).mockImplementationOnce(() => Promise.resolve(updated_user))
            jest.spyOn(mockUserRepository, "validUser").mockImplementation(() => Promise.resolve(1))

            const getAllUsersUse = new ValidUser(mockUserRepository, mockProjectRepository, mockPrivilegeRepository)

            try {
                await getAllUsersUse.execute(user_id, confirmation_token);
                expect(true).toBe(false)
            } catch (e) {
                expect(mockUserRepository.verifyValidationToken).toHaveBeenCalledWith(confirmation_token);
                expect(mockUserRepository.getUser).not.toBeCalled();
                expect(mockUserRepository.validUser).not.toBeCalled();
                expect(e.message).toBe("User vallidation forbidden")
            }
        });
        test("User is deleted", async () => {
            const user_id = 1
            const confirmation_token = "token"

            const decoded_token: DecodedToken = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const user_to_update: UserResponseModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00',
                deleted: '2023-08-01 10:31:00'
            }
            const updated_user: UserResponseModel = {
                user_id: 1,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                confirmation_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00'
            }


            jest.spyOn(mockUserRepository, "verifyValidationToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(user_to_update)).mockImplementationOnce(() => Promise.resolve(updated_user))
            jest.spyOn(mockUserRepository, "validUser").mockImplementation(() => Promise.resolve(1))

            const getAllUsersUse = new ValidUser(mockUserRepository, mockProjectRepository, mockPrivilegeRepository)
            try {
                await getAllUsersUse.execute(user_id, confirmation_token);
                expect(true).toBe(false)
            } catch (e) {
                expect(e.message).toBe("User is deleted")
                expect(mockUserRepository.verifyValidationToken).toHaveBeenCalledWith(confirmation_token);
                expect(mockUserRepository.getUser).toBeCalledTimes(1);
                expect(mockUserRepository.validUser).not.toBeCalled();
            }

        });

        test("Cannot find user with confirmation code", async () => {

            const user_id = 1
            const confirmation_token = "token"

            const decoded_token: DecodedToken = {
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const user_to_update = null
            const updated_user: UserResponseModel = {
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                confirmation_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00'
            }


            jest.spyOn(mockUserRepository, "verifyValidationToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(user_to_update)).mockImplementationOnce(() => Promise.resolve(updated_user))
            jest.spyOn(mockUserRepository, "validUser").mockImplementation(() => Promise.resolve(1))

            const getAllUsersUse = new ValidUser(mockUserRepository, mockProjectRepository, mockPrivilegeRepository)

            try {
                await getAllUsersUse.execute(user_id, confirmation_token);
                expect(true).toBe(false)
            } catch (e) {
                expect(mockUserRepository.verifyValidationToken).toHaveBeenCalledWith(confirmation_token);
                expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { user_id: user_id, confirmation_code: decoded_token.confirmation_code });
                expect(mockUserRepository.getUser).toHaveBeenCalledTimes(1);
                expect(mockUserRepository.validUser).not.toBeCalled();
                expect(e.message).toBe("Cannot find user with confirmation code")
            }
        });

        test("Cannot find user with confirmation code", async () => {

            const user_id = 1
            const confirmation_token = "token"

            const decoded_token: DecodedToken = {
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const user_to_update: UserResponseModel = {
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00'
            }
            const updated_user: UserResponseModel = {
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: true,
                confirmation_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00'
            }


            jest.spyOn(mockUserRepository, "verifyValidationToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(user_to_update)).mockImplementationOnce(() => Promise.resolve(updated_user))
            jest.spyOn(mockUserRepository, "validUser").mockImplementation(() => Promise.resolve(0))

            const getAllUsersUse = new ValidUser(mockUserRepository, mockProjectRepository, mockPrivilegeRepository)

            try {
                await getAllUsersUse.execute(user_id, confirmation_token);
                expect(true).toBe(false)
            } catch (e) {
                expect(mockUserRepository.verifyValidationToken).toHaveBeenCalledWith(confirmation_token);
                expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { user_id: user_id, confirmation_code: decoded_token.confirmation_code });
                expect(mockUserRepository.getUser).toHaveBeenCalledTimes(1);
                expect(mockUserRepository.validUser).toHaveBeenCalledWith({ user_id: user_to_update.user_id });

                expect(e.message).toBe("Cannot update user")
            }
        });

        test("Cannot find updated user", async () => {

            const user_id = 1
            const confirmation_token = "token"

            const decoded_token: DecodedToken = {
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const user_to_update: UserResponseModel = {
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00'
            }
            const updated_user = null

            jest.spyOn(mockUserRepository, "verifyValidationToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(user_to_update)).mockImplementationOnce(() => Promise.resolve(updated_user))
            jest.spyOn(mockUserRepository, "validUser").mockImplementation(() => Promise.resolve(1))

            const getAllUsersUse = new ValidUser(mockUserRepository, mockProjectRepository, mockPrivilegeRepository)

            try {
                await getAllUsersUse.execute(user_id, confirmation_token);
                expect(true).toBe(false)
            } catch (e) {
                expect(mockUserRepository.verifyValidationToken).toHaveBeenCalledWith(confirmation_token);
                expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { user_id: user_id, confirmation_code: decoded_token.confirmation_code });
                expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(2, { user_id: user_id });
                expect(mockUserRepository.validUser).toHaveBeenCalledWith({ user_id: user_to_update.user_id });

                expect(e.message).toBe("Cannot find updated user")
            }
        });
        test("Cannot validate user", async () => {

            const user_id = 1
            const confirmation_token = "token"

            const decoded_token: DecodedToken = {
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00',

                iat: 1693237789,
                exp: 1724795389
            }
            const user_to_update: UserResponseModel = {
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: "confirmation_code",
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00'
            }
            const updated_user: UserResponseModel = {
                user_id: user_id,
                last_name: "Smith",
                first_name: "John",
                email: "john@gmail.com",
                is_admin: false,
                valid_email: false,
                confirmation_code: null,
                organisation: "LOV",
                country: "France",
                user_planned_usage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
                user_creation_utc_date_time: '2023-08-01 10:30:00'
            }

            jest.spyOn(mockUserRepository, "verifyValidationToken").mockImplementation(() => { return decoded_token })
            jest.spyOn(mockUserRepository, "getUser").mockImplementationOnce(() => Promise.resolve(user_to_update)).mockImplementationOnce(() => Promise.resolve(updated_user))
            jest.spyOn(mockUserRepository, "validUser").mockImplementation(() => Promise.resolve(1))
            jest.spyOn(mockProjectRepository, "listProjects")

            const getAllUsersUse = new ValidUser(mockUserRepository, mockProjectRepository, mockPrivilegeRepository)

            try {
                await getAllUsersUse.execute(user_id, confirmation_token);
                expect(true).toBe(false)
            } catch (e) {
                expect(mockUserRepository.verifyValidationToken).toHaveBeenCalledWith(confirmation_token);
                expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(1, { user_id: user_id, confirmation_code: decoded_token.confirmation_code });
                expect(mockUserRepository.getUser).toHaveBeenNthCalledWith(2, { user_id: user_id });
                expect(mockUserRepository.validUser).toHaveBeenCalledWith({ user_id: user_to_update.user_id });
                expect(mockProjectRepository.listProjects).toBeCalledTimes(0);

                expect(e.message).toBe("Cannot validate user")
            }
        });
    })
})
