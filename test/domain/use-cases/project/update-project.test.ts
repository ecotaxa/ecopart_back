import { ProjectResponseModel, PublicProjectResponseModel, PublicProjectUpdateModel } from "../../../../src/domain/entities/project";
import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { InstrumentModelRepository } from "../../../../src/domain/interfaces/repositories/instrument_model-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { UpdateProject } from '../../../../src/domain/use-cases/project/update-project'
import { projectResponseModel, projectUpdateModel, projectUpdateModel_withInstrumentModel, projectUpdateModel_withPartialPrivilegeUpdate, projectUpdateModel_withPrivilegeUpdate } from "../../../entities/project";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockInstrumentModelRepository } from "../../../mocks/instrumentModel-mock";
import { PublicPrivilege } from "../../../../src/domain/entities/privilege";
import { publicPrivileges } from "../../../entities/privilege";
import { instrument_model_response } from "../../../entities/instrumentModel";

/* TESTED HERE */
// User is not admin : edit regular properties on himself : ok
// User is not admin : edit admin property on himself : nok
// user is not admin : edit someone else regular properties : nok
// user is not admin : edit someone else adminproperty : nok

// user is admin : edit regular properties on himself : ok
// user is admin : edit admin property on himself : ok
// user is admin : edit someone else regular properties : ok
// user is admin : edit someone else adminproperty : ok

let mockUserRepository: UserRepository;
let mockProjectRepository: ProjectRepository;
let mockInstrumentModelRepository: InstrumentModelRepository;
let mockPrivilegeRepository: PrivilegeRepository;

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockProjectRepository = new MockProjectRepository()
    mockInstrumentModelRepository = new MockInstrumentModelRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()
})

test("Current_user is deleted or invalid", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: PublicProjectUpdateModel = projectUpdateModel

    const OutputError = new Error("User cannot be used")

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.reject(OutputError))
    jest.spyOn(mockUserRepository, "isAdmin")
    jest.spyOn(mockProjectRepository, "standardUpdateProject")
    jest.spyOn(mockProjectRepository, "getProject")

    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)
    try {
        await updateProjectUseCase.execute(current_user, project_to_update);
        expect(true).toBe(false)
    } catch (err) {
        expect(err).toStrictEqual(OutputError);
    }

    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(1)
    expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(0)
    expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(0)
    expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(0)

});

test("User can update project", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: PublicProjectUpdateModel = projectUpdateModel
    const OutputData: ProjectResponseModel = projectResponseModel
    const privileges: PublicPrivilege = publicPrivileges
    const updated_public_project: PublicProjectResponseModel = projectResponseModel


    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "getProject").mockImplementationOnce(() => Promise.resolve(projectResponseModel)).mockImplementationOnce(() => Promise.resolve(OutputData))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockUserRepository, "isAdmin")//.mockImplementation(() => Promise.resolve(true))
    jest.spyOn(mockProjectRepository, "standardUpdateProject").mockImplementationOnce(() => Promise.resolve(1))
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementationOnce(() => Promise.resolve(privileges))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => updated_public_project)

    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)

    const data = await updateProjectUseCase.execute(current_user, project_to_update);

    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(1)
    expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(0)
    expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(1)
    expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(2)
    expect(data).toStrictEqual(OutputData);

});

test("Cannot update project", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: PublicProjectUpdateModel = projectUpdateModel

    const OutputError = new Error("Cannot update project")

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "getProject").mockImplementationOnce(() => Promise.resolve(projectResponseModel))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockUserRepository, "isAdmin")//.mockImplementation(() => Promise.resolve(true))
    jest.spyOn(mockProjectRepository, "standardUpdateProject").mockImplementationOnce(() => Promise.resolve(0))


    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)
    try {
        await updateProjectUseCase.execute(current_user, project_to_update);
        expect(true).toBe(false)
    } catch (err) {
        expect(err).toStrictEqual(OutputError);
    }

    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(1)
    expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(0)
    expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(1)
    expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)

});

test("Cannot find updated project", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: PublicProjectUpdateModel = projectUpdateModel

    const OutputError = new Error("Cannot find updated project")

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "getProject").mockImplementationOnce(() => Promise.resolve(projectResponseModel)).mockImplementationOnce(() => Promise.resolve(null))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockUserRepository, "isAdmin")//.mockImplementation(() => Promise.resolve(true))
    jest.spyOn(mockProjectRepository, "standardUpdateProject").mockImplementationOnce(() => Promise.resolve(1))
    //jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementationOnce(() => Promise.resolve(privileges))
    //jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => updated_public_project)

    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)
    try {
        await updateProjectUseCase.execute(current_user, project_to_update);
        expect(true).toBe(false)
    } catch (err) {
        expect(err).toStrictEqual(OutputError);
    }

    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(1)
    expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(0)
    expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(1)
    expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(2)

});
test("User try to update an unexisting project", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: PublicProjectUpdateModel = projectUpdateModel

    const OutputError = new Error("Cannot find project to update")

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "getProject").mockImplementationOnce(() => Promise.resolve(null))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockUserRepository, "isAdmin")
    jest.spyOn(mockProjectRepository, "standardUpdateProject").mockImplementationOnce(() => Promise.resolve(1))

    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)
    try {
        await updateProjectUseCase.execute(current_user, project_to_update);
        expect(true).toBe(false)
    } catch (err) {
        expect(err).toStrictEqual(OutputError);
    }

    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(1)
    expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(0)
    expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(0)
    expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)

});

test("User is not admin and have no privilege on the project", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: PublicProjectUpdateModel = projectUpdateModel

    const OutputError = new Error("Logged user cannot update this property or project")

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "getProject").mockImplementationOnce(() => Promise.resolve(projectResponseModel))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockUserRepository, "isAdmin").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockProjectRepository, "standardUpdateProject").mockImplementationOnce(() => Promise.resolve(1))

    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)
    try {
        await updateProjectUseCase.execute(current_user, project_to_update);
        expect(true).toBe(false)
    } catch (err) {
        expect(err).toStrictEqual(OutputError);
    }

    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(1)
    expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(1)
    expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(0)
    expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)

});
// test admin can update privilege part
test("Admin can update privilege part", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: PublicProjectUpdateModel = projectUpdateModel
    const OutputData: ProjectResponseModel = projectResponseModel
    const privileges: PublicPrivilege = publicPrivileges
    const updated_public_project: PublicProjectResponseModel = projectResponseModel
    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockUserRepository, "isAdmin").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockProjectRepository, "standardUpdateProject").mockImplementationOnce(() => Promise.resolve(1))
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementationOnce(() => Promise.resolve(privileges))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => updated_public_project)

    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)

    const data = await updateProjectUseCase.execute(current_user, project_to_update);
    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(1)
    expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(1)
    expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(1)
    expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(2)
    expect(data).toStrictEqual(OutputData);
})
// test manager can update privilege part
test("Manager can update privilege part", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: PublicProjectUpdateModel = projectUpdateModel_withPrivilegeUpdate
    const OutputData: ProjectResponseModel = projectResponseModel
    const privileges: PublicPrivilege = publicPrivileges
    const updated_public_project: PublicProjectResponseModel = projectResponseModel
    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockUserRepository, "isAdmin").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockProjectRepository, "standardUpdateProject").mockImplementationOnce(() => Promise.resolve(1))
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementationOnce(() => Promise.resolve(privileges))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => updated_public_project)
    jest.spyOn(mockUserRepository, "ensureTypedUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "ensurePrivilegeCoherence").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "deletePrivileges").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockPrivilegeRepository, "createPrivileges").mockImplementation(() => Promise.resolve(2))

    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)
    const data = await updateProjectUseCase.execute(current_user, project_to_update);

    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(1)
    expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(0)
    expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(1)
    expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(2)
    expect(data).toStrictEqual(OutputData);
})
// test member cannot update privilege part
test("Member cannot update privilege part", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: PublicProjectUpdateModel = projectUpdateModel_withPrivilegeUpdate

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockUserRepository, "isAdmin").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockProjectRepository, "standardUpdateProject")
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges")
    jest.spyOn(mockProjectRepository, "toPublicProject")

    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)
    try {
        await updateProjectUseCase.execute(current_user, project_to_update);
        expect(true).toBe(false)
    } catch (err) {
        expect(err).toStrictEqual(new Error("Logged user cannot update privileges"));
        expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(1)
        expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(1)
        expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(0)
        expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)
    }
});
//update instrument model
test("Update instrument model", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: PublicProjectUpdateModel = projectUpdateModel_withInstrumentModel
    const OutputData: ProjectResponseModel = projectResponseModel
    const updated_public_project: PublicProjectResponseModel = projectResponseModel
    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockUserRepository, "isAdmin").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockProjectRepository, "standardUpdateProject").mockImplementationOnce(() => Promise.resolve(1))
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementationOnce(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => updated_public_project)
    jest.spyOn(mockInstrumentModelRepository, "getInstrumentByName").mockImplementationOnce(() => Promise.resolve(instrument_model_response))

    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)

    const data = await updateProjectUseCase.execute(current_user, project_to_update);
    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(1)
    expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(1)
    expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(1)
    expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(2)
    expect(data).toStrictEqual(OutputData);
});

// privileges partialy filled 
test("Update project with privileges partially filled", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: PublicProjectUpdateModel = projectUpdateModel_withPartialPrivilegeUpdate
    const privileges: PublicPrivilege = publicPrivileges
    const updated_public_project: PublicProjectResponseModel = projectResponseModel
    const expected_error = new Error("To update privilege part you must provide members, managers and contact, if you want to manage privileges more granuraly please use privilege endpoints")
    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockUserRepository, "isAdmin").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockProjectRepository, "standardUpdateProject").mockImplementationOnce(() => Promise.resolve(1))
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementationOnce(() => Promise.resolve(privileges))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => updated_public_project)
    jest.spyOn(mockUserRepository, "ensureTypedUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "ensurePrivilegeCoherence").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "deletePrivileges").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockPrivilegeRepository, "createPrivileges").mockImplementation(() => Promise.resolve(2))

    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)
    try {
        await updateProjectUseCase.execute(current_user, project_to_update);
        expect(true).toBe(false)
    } catch (err) {
        expect(err).toStrictEqual(expected_error)
        expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(1)
        expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(0)
        expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(0)
        expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)
        expect(mockPrivilegeRepository.deletePrivileges).toHaveBeenCalledTimes(0)
        expect(mockPrivilegeRepository.createPrivileges).toHaveBeenCalledTimes(0)
    }
});

// privileges partialy created
test("Update project with privileges partially created", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: PublicProjectUpdateModel = projectUpdateModel_withPrivilegeUpdate
    const privileges: PublicPrivilege = publicPrivileges
    const updated_public_project: PublicProjectResponseModel = projectResponseModel
    const expected_error = new Error("Privileges partially updated, please check members, managers and contact. Other project properties were not updated due to this error, please try again.")

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockUserRepository, "isAdmin").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockProjectRepository, "standardUpdateProject").mockImplementationOnce(() => Promise.resolve(1))
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementationOnce(() => Promise.resolve(privileges))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => updated_public_project)
    jest.spyOn(mockUserRepository, "ensureTypedUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "ensurePrivilegeCoherence").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "deletePrivileges").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockPrivilegeRepository, "createPrivileges").mockImplementation(() => Promise.resolve(1))

    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)
    try {
        await updateProjectUseCase.execute(current_user, project_to_update);
        expect(true).toBe(false)
    } catch (err) {
        expect(err).toStrictEqual(expected_error)
        expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(1)
        expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(0)
        expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(0)
        expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)
        expect(mockPrivilegeRepository.deletePrivileges).toHaveBeenCalledTimes(1)
        expect(mockPrivilegeRepository.createPrivileges).toHaveBeenCalledTimes(1)
    }
});

// please provide at least one property to update
test("Please provide at least one property to update", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: PublicProjectUpdateModel = {
        project_id: 1
    }
    const privileges: PublicPrivilege = publicPrivileges
    const updated_public_project: PublicProjectResponseModel = projectResponseModel
    const expected_error = new Error("Please provide at least one property to update")

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockPrivilegeRepository, "isManager").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockUserRepository, "isAdmin").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockProjectRepository, "standardUpdateProject").mockImplementationOnce(() => Promise.reject(new Error("Please provide at least one property to update")))
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementationOnce(() => Promise.resolve(privileges))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementationOnce(() => updated_public_project)
    jest.spyOn(mockUserRepository, "ensureTypedUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "ensurePrivilegeCoherence").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "deletePrivileges").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockPrivilegeRepository, "createPrivileges").mockImplementation(() => Promise.resolve(1))

    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)
    try {
        await updateProjectUseCase.execute(current_user, project_to_update);
        expect(true).toBe(false)
    } catch (err) {
        expect(err).toStrictEqual(expected_error)
        expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledTimes(1)
        expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(0)
        expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(1)
        expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)
        expect(mockPrivilegeRepository.deletePrivileges).toHaveBeenCalledTimes(0)
        expect(mockPrivilegeRepository.createPrivileges).toHaveBeenCalledTimes(0)
    }
});
