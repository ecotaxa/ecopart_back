import { ProjectResponseModel, ProjectUpdateModel } from "../../../../src/domain/entities/project";
import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { UpdateProject } from '../../../../src/domain/use-cases/project/update-project'
import { projectResponseModel, projectUpdateModel } from "../../../entities/project";
import { MockProjectRepository } from "../../../mocks/project-mock";
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

let mockUserRepository: UserRepository;
let mockProjectRepository: ProjectRepository;
beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockProjectRepository = new MockProjectRepository()
})

test("User is deleted", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: ProjectUpdateModel = projectUpdateModel

    const OutputError = new Error("User is deleted")

    jest.spyOn(mockUserRepository, "isDeleted").mockImplementationOnce(() => Promise.resolve(true)).mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockUserRepository, "isAdmin")
    jest.spyOn(mockProjectRepository, "standardUpdateProject")
    jest.spyOn(mockProjectRepository, "getProject")

    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository)
    try {
        await updateProjectUseCase.execute(current_user, project_to_update);
        expect(true).toBe(false)
    } catch (err) {
        expect(err).toStrictEqual(OutputError);
    }

    expect(mockUserRepository.isDeleted).toHaveBeenCalledTimes(1)
    expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(0)
    expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(0)
    expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(0)

});

test("User can update project", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: ProjectUpdateModel = projectUpdateModel
    const OutputData: ProjectResponseModel = projectResponseModel

    jest.spyOn(mockUserRepository, "isDeleted").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockUserRepository, "isAdmin").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockProjectRepository, "standardUpdateProject").mockImplementationOnce(() => Promise.resolve(1))
    jest.spyOn(mockProjectRepository, "getProject").mockImplementationOnce(() => Promise.resolve(OutputData))

    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository)

    const data = await updateProjectUseCase.execute(current_user, project_to_update);

    expect(mockUserRepository.isDeleted).toHaveBeenCalledTimes(1)
    expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(1)
    expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(1)
    expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)
    expect(data).toStrictEqual(OutputData);

});

test("Cannot update project", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: ProjectUpdateModel = projectUpdateModel

    const OutputError = new Error("Cannot update project")

    jest.spyOn(mockUserRepository, "isDeleted").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockUserRepository, "isAdmin").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockProjectRepository, "standardUpdateProject").mockImplementationOnce(() => Promise.resolve(0))
    jest.spyOn(mockProjectRepository, "getProject")

    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository)
    try {
        await updateProjectUseCase.execute(current_user, project_to_update);
        expect(true).toBe(false)
    } catch (err) {
        expect(err).toStrictEqual(OutputError);
    }

    expect(mockUserRepository.isDeleted).toHaveBeenCalledTimes(1)
    expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(1)
    expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(1)
    expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(0)

});

test("Cannot find updated project", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const project_to_update: ProjectUpdateModel = projectUpdateModel

    const OutputError = new Error("Cannot find updated project")

    jest.spyOn(mockUserRepository, "isDeleted").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockUserRepository, "isAdmin").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockProjectRepository, "standardUpdateProject").mockImplementationOnce(() => Promise.resolve(1))
    jest.spyOn(mockProjectRepository, "getProject").mockImplementationOnce(() => Promise.resolve(null))

    const updateProjectUseCase = new UpdateProject(mockUserRepository, mockProjectRepository)
    try {
        await updateProjectUseCase.execute(current_user, project_to_update);
        expect(true).toBe(false)
    } catch (err) {
        expect(err).toStrictEqual(OutputError);
    }

    expect(mockUserRepository.isDeleted).toHaveBeenCalledTimes(1)
    expect(mockUserRepository.isAdmin).toHaveBeenCalledTimes(1)
    expect(mockProjectRepository.standardUpdateProject).toHaveBeenCalledTimes(1)
    expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)

});
