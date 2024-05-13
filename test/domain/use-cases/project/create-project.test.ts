import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { CreateProject } from '../../../../src/domain/use-cases/project/create-project'
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { projectRequestCreationtModel, projectRequestCreationtModel_withmissingOverrideDepthOffset, projectResponseModel } from "../../../entities/project";
import { ProjectRequestCreationtModel, ProjectResponseModel } from "../../../../src/domain/entities/project";

let mockUserRepository: UserRepository;
let mockProjectRepository: MockProjectRepository;

beforeEach(async () => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockProjectRepository = new MockProjectRepository()

})

test("Try to add a project return created project", async () => {
    const InputData: ProjectRequestCreationtModel = projectRequestCreationtModel
    const created_project: ProjectResponseModel = projectResponseModel
    const current_user: UserUpdateModel = {
        user_id: 1
    }

    jest.spyOn(mockUserRepository, "isDeleted").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockProjectRepository, "computeDefaultDepthOffset")
    jest.spyOn(mockProjectRepository, "createProject").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(created_project))

    const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository)
    const result = await createProjectUseCase.execute(current_user, InputData);

    expect(mockUserRepository.isDeleted).toHaveBeenCalledWith(current_user.user_id);
    expect(mockProjectRepository.computeDefaultDepthOffset).not.toBeCalled();
    expect(mockProjectRepository.createProject).toHaveBeenCalledWith(InputData);
    expect(mockProjectRepository.getProject).toHaveBeenCalledWith({ project_id: 1 });
    expect(result).toStrictEqual(created_project);
});

test("Create a project without override_depth_offset", async () => {
    const InputData: ProjectRequestCreationtModel = projectRequestCreationtModel_withmissingOverrideDepthOffset
    const created_project: ProjectResponseModel = projectResponseModel
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const completedInputData = { ...InputData, override_depth_offset: 1.2 }

    jest.spyOn(mockUserRepository, "isDeleted").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockProjectRepository, "computeDefaultDepthOffset").mockImplementation(() => 1.2)
    jest.spyOn(mockProjectRepository, "createProject").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(created_project))

    const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository)
    const result = await createProjectUseCase.execute(current_user, InputData);

    expect(mockUserRepository.isDeleted).toHaveBeenCalledWith(current_user.user_id);
    expect(mockProjectRepository.computeDefaultDepthOffset).toHaveBeenCalledWith(InputData.instrument);
    expect(mockProjectRepository.createProject).toHaveBeenCalledWith(completedInputData);
    expect(mockProjectRepository.getProject).toHaveBeenCalledWith({ project_id: 1 });
    expect(result).toStrictEqual(created_project);
});

test("Can't find created project", async () => {
    const InputData: ProjectRequestCreationtModel = projectRequestCreationtModel
    const current_user: UserUpdateModel = {
        user_id: 1
    }

    jest.spyOn(mockUserRepository, "isDeleted").mockImplementationOnce(() => Promise.resolve(false))
    jest.spyOn(mockProjectRepository, "computeDefaultDepthOffset")
    jest.spyOn(mockProjectRepository, "createProject").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(null))

    const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository)
    await expect(createProjectUseCase.execute(current_user, InputData)).rejects.toThrowError("Can't find created project");

    expect(mockUserRepository.isDeleted).toHaveBeenCalledWith(current_user.user_id);
    expect(mockProjectRepository.computeDefaultDepthOffset).not.toBeCalled();
    expect(mockProjectRepository.createProject).toHaveBeenCalledWith(InputData);
    expect(mockProjectRepository.getProject).toHaveBeenCalledWith({ project_id: 1 });
});

test("Can't create project because user is deleted", async () => {

    const InputData: ProjectRequestCreationtModel = projectRequestCreationtModel
    const current_user: UserUpdateModel = {
        user_id: 1
    }

    jest.spyOn(mockUserRepository, "isDeleted").mockImplementationOnce(() => Promise.resolve(true))
    jest.spyOn(mockProjectRepository, "computeDefaultDepthOffset")
    jest.spyOn(mockProjectRepository, "createProject")
    jest.spyOn(mockProjectRepository, "getProject")

    const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository)
    await expect(createProjectUseCase.execute(current_user, InputData)).rejects.toThrowError("User is deleted");

    expect(mockUserRepository.isDeleted).toHaveBeenCalledWith(current_user.user_id);
    expect(mockProjectRepository.computeDefaultDepthOffset).not.toBeCalled();
    expect(mockProjectRepository.createProject).not.toBeCalled();
    expect(mockProjectRepository.getProject).not.toBeCalled();

});
