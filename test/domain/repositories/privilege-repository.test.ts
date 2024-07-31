//test/domain/repositories/privilege-repository.test.ts
import { PrivilegeDataSource } from "../../../src/data/interfaces/data-sources/privilege-data-source";
import { PrivilegeResponseModel, PublicPrivilege } from "../../../src/domain/entities/privilege";
import { SearchResult } from "../../../src/domain/entities/search";
import { PrivilegeRepository } from "../../../src/domain/interfaces/repositories/privilege-repository";
import { PrivilegeRepositoryImpl } from "../../../src/domain/repositories/privilege-repository";
import { coherentPrivileges, privilegesRequestCreation_WithMemberAndManager, privilegesResponse_WithMemberAndManager, privileges_WithContactNetherManagerNorMember, privileges_WithNoManager, privileges_WithOneUserMemberAndManager, publicPrivilegesResponse_WithMemberAndManager, publicPrivileges_WithMemberAndManager } from "../../entities/privilege";
import { MockPrivilegeDataSource } from "../../mocks/privilege-mock";

import 'dotenv/config'

describe("Privilege Repository", () => {
    let mockPrivilegeDataSource: PrivilegeDataSource;

    let privilegeRepository: PrivilegeRepository

    beforeEach(() => {
        jest.clearAllMocks();
        mockPrivilegeDataSource = new MockPrivilegeDataSource()
        privilegeRepository = new PrivilegeRepositoryImpl(mockPrivilegeDataSource)
    })

    // to test : createPrivileges, getPublicPrivileges, getProjectsByUser, getProjectsByUsers, getProjectsByContacts, getProjectsByManagers, getProjectsByMembers, isGranted, isManager, getContact, deletePrivileges, ensurePrivilegeCoherence

    describe("CreatePrivileges", () => {
        test("Should create a privilege and return 1", async () => {
            const privilege: PublicPrivilege = publicPrivileges_WithMemberAndManager

            jest.spyOn(mockPrivilegeDataSource, 'create').mockResolvedValue(1)

            const result = await privilegeRepository.createPrivileges(privilege)

            expect(mockPrivilegeDataSource.create).toBeCalledTimes(2)
            expect(mockPrivilegeDataSource.create).toHaveBeenNthCalledWith(1, privilegesRequestCreation_WithMemberAndManager[0])
            expect(mockPrivilegeDataSource.create).toHaveBeenNthCalledWith(2, privilegesRequestCreation_WithMemberAndManager[1])

            expect(result).toBe(2)
        });
        test("Should return 0 if no privilege is created", async () => {
            const privilege: PublicPrivilege = publicPrivileges_WithMemberAndManager

            jest.spyOn(mockPrivilegeDataSource, 'create').mockImplementation(() => Promise.reject(new Error("Error")))

            const result = await privilegeRepository.createPrivileges(privilege)

            expect(mockPrivilegeDataSource.create).toBeCalledTimes(2)
            expect(mockPrivilegeDataSource.create).toHaveBeenNthCalledWith(1, privilegesRequestCreation_WithMemberAndManager[0])
            expect(mockPrivilegeDataSource.create).toHaveBeenNthCalledWith(2, privilegesRequestCreation_WithMemberAndManager[1])

            expect(result).toBe(0)
        });
    });

    describe("GetPublicPrivileges", () => {
        test("Should return public privileges", async () => {
            const all_projects: SearchResult<PrivilegeResponseModel> = { total: 2, items: privilegesResponse_WithMemberAndManager }

            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue(all_projects)

            const result = await privilegeRepository.getPublicPrivileges({ project_id: 1 })

            expect(result).toStrictEqual(publicPrivilegesResponse_WithMemberAndManager)
        });
    });
    describe("GetProjectsByUser", () => {
        test("Should return projects by user", async () => {
            const projects_ids: number[] = [1]
            const privileges: SearchResult<PrivilegeResponseModel> = { total: 2, items: [privilegesResponse_WithMemberAndManager[0]] }
            const privilege = { user_id: 1 }

            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue(privileges)

            const result = await privilegeRepository.getProjectsByUser(privilege)

            expect(result).toStrictEqual(projects_ids)
        });
        test("Should return empty array if no project is found", async () => {
            const projects_ids: number[] = []
            const privileges: SearchResult<PrivilegeResponseModel> = { total: 0, items: [] }
            const privilege = { user_id: 1 }

            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue(privileges)

            const result = await privilegeRepository.getProjectsByUser(privilege)

            expect(result).toStrictEqual(projects_ids)
        });
    });
    describe("GetProjectsByUsers", () => {
        test("Should return projects by users", async () => {
            const projects_ids: number[] = [1]
            const privileges: SearchResult<PrivilegeResponseModel> = { total: 2, items: privilegesResponse_WithMemberAndManager }
            const privilege_users = [1, 2]

            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue(privileges)

            const result = await privilegeRepository.getProjectsByUsers(privilege_users)

            expect(result).toStrictEqual(projects_ids)
        });
        test("Should return empty array if no project is found", async () => {
            const projects_ids: number[] = []
            const privileges: SearchResult<PrivilegeResponseModel> = { total: 0, items: [] }
            const privilege_users = [1, 2]

            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue(privileges)

            const result = await privilegeRepository.getProjectsByUsers(privilege_users)

            expect(result).toStrictEqual(projects_ids)
        });
    });
    describe("GetProjectsByContacts", () => {
        test("Should return all projects where a list of user ids are contact", async () => {
            const projects_ids: number[] = [1]
            const privileges: SearchResult<PrivilegeResponseModel> = { total: 1, items: [privilegesResponse_WithMemberAndManager[1]] }
            const privilege_contacts = [1, 2]

            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue(privileges)

            const result = await privilegeRepository.getProjectsByContacts(privilege_contacts)

            expect(result).toStrictEqual(projects_ids)
        });
        test("Should return empty array if no project is found", async () => {
            const projects_ids: number[] = []
            const privileges: SearchResult<PrivilegeResponseModel> = { total: 0, items: [] }
            const privilege_contacts = [2]

            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue(privileges)

            const result = await privilegeRepository.getProjectsByContacts(privilege_contacts)

            expect(result).toStrictEqual(projects_ids)
        });
    });
    describe("GetProjectsByManagers", () => {
        test("Should return all projects where a list of user ids are managers", async () => {
            const projects_ids: number[] = [1]
            const privileges: SearchResult<PrivilegeResponseModel> = { total: 1, items: [privilegesResponse_WithMemberAndManager[0]] }
            const privilege_managers = [1, 2]

            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue(privileges)

            const result = await privilegeRepository.getProjectsByManagers(privilege_managers)

            expect(result).toStrictEqual(projects_ids)
        });
        test("Should return empty array if no project is found", async () => {
            const projects_ids: number[] = []
            const privileges: SearchResult<PrivilegeResponseModel> = { total: 0, items: [] }
            const privilege_managers = [2]

            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue(privileges)

            const result = await privilegeRepository.getProjectsByManagers(privilege_managers)

            expect(result).toStrictEqual(projects_ids)
        });
    });
    describe("GetProjectsByMembers", () => {
        test("Should return all projects where a list of user ids are members", async () => {
            const projects_ids: number[] = [1]
            const privileges: SearchResult<PrivilegeResponseModel> = { total: 1, items: [privilegesResponse_WithMemberAndManager[1]] }
            const privilege_members = [2]

            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue(privileges)

            const result = await privilegeRepository.getProjectsByMembers(privilege_members)

            expect(result).toStrictEqual(projects_ids)
        });
        test("Should return empty array if no project is found", async () => {
            const projects_ids: number[] = []
            const privileges: SearchResult<PrivilegeResponseModel> = { total: 0, items: [] }
            const privilege_members = [1]

            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue(privileges)

            const result = await privilegeRepository.getProjectsByMembers(privilege_members)

            expect(result).toStrictEqual(projects_ids)
        });
    });

    describe("IsGranted", () => {
        test("Should return true if privilege is granted", async () => {
            const privilege = { user_id: 1, project_id: 1 }
            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue({ total: 1, items: [privilegesResponse_WithMemberAndManager[0]] })

            const result = await privilegeRepository.isGranted(privilege)

            expect(result).toBe(true)
        });
        test("Should return false if privilege is not granted", async () => {
            const privilege = { user_id: 1, project_id: 1 }
            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue({ total: 0, items: [] })

            const result = await privilegeRepository.isGranted(privilege)

            expect(result).toBe(false)
        });
        test("Please provide a valid user_id and project_id to check if a privilege is granted for a project and a user", async () => {
            const privilege = { user_id: 1 }
            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue({ total: 0, items: [] })

            try {
                await privilegeRepository.isGranted(privilege)
                expect(true).toBe(false)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Please provide a valid user_id and project_id to check if a privilege is granted for a project and a user")
            }
        });
    });
    describe("IsManager", () => {
        test("Should return true if user is manager", async () => {
            const privilege = { user_id: 1, project_id: 1 }
            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue({ total: 1, items: [privilegesResponse_WithMemberAndManager[0]] })

            const result = await privilegeRepository.isManager(privilege)

            expect(result).toBe(true)
        });
        test("Should return false if user is not manager", async () => {
            const privilege = { user_id: 1, project_id: 1 }
            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue({ total: 0, items: [] })

            const result = await privilegeRepository.isManager(privilege)

            expect(result).toBe(false)
        });
        test("Please provide a valid user_id and project_id to check if a user is a manager for a project", async () => {
            const privilege = { user_id: 1 }
            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue({ total: 0, items: [] })

            try {
                await privilegeRepository.isManager(privilege)
                expect(true).toBe(false)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Please provide a valid user_id and project_id to check if a user is a manager for a project")
            }
        });
    });
    describe("GetContact", () => {
        test("Should return contact", async () => {
            const project_request = { project_id: 1 }
            const contact = privilegesResponse_WithMemberAndManager[0]
            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue({ total: 1, items: [privilegesResponse_WithMemberAndManager[0]] })

            const result = await privilegeRepository.getContact(project_request)

            expect(result).toStrictEqual(contact)
        });
        test("Should return null if no contact is found", async () => {
            const project_request = { project_id: 1 }
            jest.spyOn(mockPrivilegeDataSource, 'getAll').mockResolvedValue({ total: 0, items: [] })
            try {
                await privilegeRepository.getContact(project_request)
                expect(true).toBe(false)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("No contact found for this project")
            }

        });
    });
    describe("DeletePrivileges", () => {
        test("Should delete privileges", async () => {
            const privilege = { project_id: 1 }
            jest.spyOn(mockPrivilegeDataSource, 'deleteAll').mockResolvedValue(1)

            const result = await privilegeRepository.deletePrivileges(privilege)

            expect(mockPrivilegeDataSource.deleteAll).toBeCalledWith(privilege)
            expect(result).toBe(1)
        });
        test("Should return 0 if no privilege is deleted", async () => {
            const privilege = { project_id: 1 }
            jest.spyOn(mockPrivilegeDataSource, 'deleteAll').mockResolvedValue(0)

            const result = await privilegeRepository.deletePrivileges(privilege)

            expect(mockPrivilegeDataSource.deleteAll).toBeCalledWith(privilege)
            expect(result).toBe(0)
        });
        test("Should throw an error if no valid parameter is provided", async () => {
            const privilege = { privilege_name: "manager" }
            jest.spyOn(mockPrivilegeDataSource, 'deleteAll').mockResolvedValue(0)

            try {
                await privilegeRepository.deletePrivileges(privilege)
                expect(true).toBe(false)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Please provide at least one valid parameter to delete privilege")
            }
        });
    });
    describe("EnsurePrivilegeCoherence", () => {
        test("Should return true if privileges are coherent", async () => {

            try {
                privilegeRepository.ensurePrivilegeCoherence(coherentPrivileges)
            } catch (e) {
                expect(true).toBe(false)
            }
        });
        test("Contact user must be either in members or managers", async () => {
            const privilege = privileges_WithContactNetherManagerNorMember

            try {
                privilegeRepository.ensurePrivilegeCoherence(privilege)
                expect(true).toBe(false)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Contact user must be either in members or managers")
            }
        });
        test("At least one user must be a manager", async () => {
            const privilege = privileges_WithNoManager

            try {
                privilegeRepository.ensurePrivilegeCoherence(privilege)
                expect(true).toBe(false)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("At least one user must be a manager")
            }
        });
        test("A user cannot be both a member and a manager", async () => {
            const privilege = privileges_WithOneUserMemberAndManager

            try {
                privilegeRepository.ensurePrivilegeCoherence(privilege)
                expect(true).toBe(false)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("A user cannot be both a member and a manager")
            }
        });
    });
})
