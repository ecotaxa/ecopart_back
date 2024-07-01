import { ProjectResponseModel, PublicProjectResponseModel, PublicProjectUpdateModel } from "../../../../src/domain/entities/project";
import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { InstrumentModelRepository } from "../../../../src/domain/interfaces/repositories/instrument_model-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { UpdateProject } from '../../../../src/domain/use-cases/project/update-project'
import { projectResponseModel, projectUpdateModel } from "../../../entities/project";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockInstrumentModelRepository } from "../../../mocks/instrumentModel-mock";
import { PublicPrivilege } from "../../../../src/domain/entities/privilege";
import { publicPrivileges } from "../../../entities/privilege";

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
