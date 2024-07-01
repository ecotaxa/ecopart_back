import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { CreateProject } from '../../../../src/domain/use-cases/project/create-project'
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { projectRequestCreationModel, projectRequestCreationModelForRepository, projectRequestCreationModel_withmissingOverrideDepthOffset, projectResponseModel } from "../../../entities/project";
import { ProjectResponseModel, PublicProjectRequestCreationModel } from "../../../../src/domain/entities/project";
import { MockInstrumentModelRepository } from "../../../mocks/instrumentModel-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { instrument_model_response } from "../../../entities/instrumentModel";
import { publicPrivileges } from "../../../entities/privilege";

let mockUserRepository: UserRepository;
let mockProjectRepository: MockProjectRepository;
let mockInstrumentModelRepository: MockInstrumentModelRepository;
let mockPrivilegeRepository: MockPrivilegeRepository;

beforeEach(async () => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockProjectRepository = new MockProjectRepository()
    mockInstrumentModelRepository = new MockInstrumentModelRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()

})

test("Try to add a project return created project", async () => {
    const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel
    const current_user: UserUpdateModel = {
        user_id: 1
    }

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "computeDefaultDepthOffset")
    jest.spyOn(mockProjectRepository, "createProject").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel))
    jest.spyOn(mockInstrumentModelRepository, "getInstrumentByName").mockImplementation(() => Promise.resolve(instrument_model_response))
    jest.spyOn(mockUserRepository, "ensureTypedUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "ensurePrivilegeCoherence").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "formatProjectRequestCreationModel").mockImplementation(() => projectRequestCreationModelForRepository)
    jest.spyOn(mockPrivilegeRepository, "createPrivileges").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementation(() => projectResponseModel)

    const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)
    const result = await createProjectUseCase.execute(current_user, InputData);

    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledWith(current_user.user_id);
    expect(mockProjectRepository.computeDefaultDepthOffset).not.toBeCalled();
    expect(mockProjectRepository.createProject).toHaveBeenCalledWith(projectRequestCreationModelForRepository);
    expect(mockProjectRepository.getProject).toHaveBeenCalledWith({ project_id: 1 });
    expect(result).toStrictEqual(projectResponseModel);
});

test("Create a project without override_depth_offset", async () => {
    const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel_withmissingOverrideDepthOffset
    const created_project: ProjectResponseModel = projectResponseModel
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const completedInputData = { ...InputData, override_depth_offset: 1 }

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "computeDefaultDepthOffset").mockImplementation(() => 100)
    jest.spyOn(mockProjectRepository, "createProject").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(created_project))

    jest.spyOn(mockInstrumentModelRepository, "getInstrumentByName").mockImplementation(() => Promise.resolve(instrument_model_response))
    jest.spyOn(mockUserRepository, "ensureTypedUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "ensurePrivilegeCoherence").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "formatProjectRequestCreationModel").mockImplementation(() => projectRequestCreationModelForRepository)
    jest.spyOn(mockPrivilegeRepository, "createPrivileges").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementation(() => projectResponseModel)


    const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)
    const result = await createProjectUseCase.execute(current_user, InputData);

    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledWith(current_user.user_id);
    expect(mockProjectRepository.computeDefaultDepthOffset).toHaveBeenCalledWith(InputData.instrument_model);
    expect(mockProjectRepository.createProject).toHaveBeenCalledWith(completedInputData);
    expect(mockProjectRepository.getProject).toHaveBeenCalledWith({ project_id: 1 });
    expect(result).toStrictEqual(created_project);
});

test("Cannot find created project", async () => {
    const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel
    const current_user: UserUpdateModel = {
        user_id: 1
    }

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "computeDefaultDepthOffset")
    jest.spyOn(mockProjectRepository, "createProject").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(null))

    const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)
    await expect(createProjectUseCase.execute(current_user, InputData)).rejects.toThrowError("Cannot find created project");

    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledWith(current_user.user_id);
    expect(mockProjectRepository.computeDefaultDepthOffset).not.toBeCalled();
    expect(mockProjectRepository.createProject).toHaveBeenCalledWith(InputData);
    expect(mockProjectRepository.getProject).toHaveBeenCalledWith({ project_id: 1 });
});

test("Cannot create project because user is deleted", async () => {

    const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const outputError = new Error("User cannot be used")

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.reject(outputError))
    jest.spyOn(mockProjectRepository, "computeDefaultDepthOffset")
    jest.spyOn(mockProjectRepository, "createProject")
    jest.spyOn(mockProjectRepository, "getProject")

    const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository)
    await expect(createProjectUseCase.execute(current_user, InputData)).rejects.toThrowError(outputError);

    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledWith(current_user.user_id);
    expect(mockProjectRepository.computeDefaultDepthOffset).not.toBeCalled();
    expect(mockProjectRepository.createProject).not.toBeCalled();
    expect(mockProjectRepository.getProject).not.toBeCalled();

});
