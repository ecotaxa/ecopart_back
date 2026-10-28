import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { CreateProject } from '../../../../src/domain/use-cases/project/create-project'
import { MockEcotaxaAccountRepository, MockUserRepository } from "../../../mocks/user-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { privateProjectRequestCreationModel_withmissingOverrideDepthOffset, projectRequestCreationModel, projectRequestCreationModelForRepository, projectRequestCreationModel_withmissingOverrideDepthOffset, projectResponseModel } from "../../../entities/project";
import { ProjectResponseModel, PublicProjectRequestCreationModel } from "../../../../src/domain/entities/project";
import { MockInstrumentModelRepository } from "../../../mocks/instrumentModel-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { instrument_model_response } from "../../../entities/instrumentModel";
import { publicPrivileges, publicPrivileges_WithMemberAndManager } from "../../../entities/privilege";

let mockUserRepository: UserRepository;
let mockProjectRepository: MockProjectRepository;
let mockInstrumentModelRepository: MockInstrumentModelRepository;
let mockPrivilegeRepository: MockPrivilegeRepository;
let mockEcotaxaAccountRepository: MockEcotaxaAccountRepository;
let DATA_STORAGE_FS_STORAGE: string;
let DATA_STORAGE_IMPORT: string;

beforeEach(async () => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockProjectRepository = new MockProjectRepository()
    mockInstrumentModelRepository = new MockInstrumentModelRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()
    mockEcotaxaAccountRepository = new MockEcotaxaAccountRepository()
    DATA_STORAGE_FS_STORAGE = "data_storage/files_system_storage/"
    DATA_STORAGE_IMPORT = "data_storage/ecopart_data_to_import/"
    // By default no account uses the emails the project names
    jest.spyOn(mockUserRepository, "getUser").mockResolvedValue(null)
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
    jest.spyOn(mockPrivilegeRepository, "createPrivileges").mockImplementation(() => Promise.resolve(2))
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges_WithMemberAndManager))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementation(() => projectResponseModel)
    jest.spyOn(mockProjectRepository, "createProjectRootFolder").mockImplementation(() => Promise.resolve())

    const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository, mockEcotaxaAccountRepository, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_IMPORT)
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
    const completedInputData = { ...privateProjectRequestCreationModel_withmissingOverrideDepthOffset, override_depth_offset: 1 }

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "computeDefaultDepthOffset").mockImplementation(() => 100)
    jest.spyOn(mockProjectRepository, "createProject").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(created_project))

    jest.spyOn(mockInstrumentModelRepository, "getInstrumentByName").mockImplementation(() => Promise.resolve(instrument_model_response))
    jest.spyOn(mockUserRepository, "ensureTypedUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "ensurePrivilegeCoherence").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "formatProjectRequestCreationModel").mockImplementation(() => projectRequestCreationModelForRepository)
    jest.spyOn(mockPrivilegeRepository, "createPrivileges").mockImplementation(() => Promise.resolve(2))
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges_WithMemberAndManager))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementation(() => projectResponseModel)
    jest.spyOn(mockProjectRepository, "createProjectRootFolder").mockImplementation(() => Promise.resolve())

    const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository, mockEcotaxaAccountRepository, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_IMPORT)
    const result = await createProjectUseCase.execute(current_user, InputData);

    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledWith(current_user.user_id);
    expect(mockProjectRepository.computeDefaultDepthOffset).toHaveBeenCalledWith(InputData.instrument_model);
    expect(mockProjectRepository.createProject).toHaveBeenCalledWith(completedInputData);
    expect(mockProjectRepository.getProject).toHaveBeenCalledWith({ project_id: 1 });
    expect(result).toStrictEqual(created_project);
});

test("Cannot find the created project.", async () => {
    const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel
    const current_user: UserUpdateModel = {
        user_id: 1
    }

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "computeDefaultDepthOffset")
    jest.spyOn(mockInstrumentModelRepository, "getInstrumentByName").mockImplementation(() => Promise.resolve(instrument_model_response))
    jest.spyOn(mockUserRepository, "ensureTypedUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "ensurePrivilegeCoherence").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "formatProjectRequestCreationModel").mockImplementation(() => projectRequestCreationModelForRepository)

    jest.spyOn(mockProjectRepository, "createProject").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(null))
    jest.spyOn(mockProjectRepository, "createProjectRootFolder").mockImplementation(() => Promise.resolve())

    const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository, mockEcotaxaAccountRepository, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_IMPORT)
    await expect(createProjectUseCase.execute(current_user, InputData)).rejects.toThrowError("Cannot find the created project.");

    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledWith(current_user.user_id);
    expect(mockProjectRepository.computeDefaultDepthOffset).not.toBeCalled();
    expect(mockProjectRepository.createProject).toHaveBeenCalledWith(projectRequestCreationModelForRepository);
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

    const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository, mockEcotaxaAccountRepository, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_IMPORT)
    await expect(createProjectUseCase.execute(current_user, InputData)).rejects.toThrowError(outputError);

    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledWith(current_user.user_id);
    expect(mockProjectRepository.computeDefaultDepthOffset).not.toBeCalled();
    expect(mockProjectRepository.createProject).not.toBeCalled();
    expect(mockProjectRepository.getProject).not.toBeCalled();

});

test("Create project but something went wrong during privilege creation", async () => {
    const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const outputError = new Error("Privileges partially created, please check members, managers and contact")

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "computeDefaultDepthOffset")
    jest.spyOn(mockProjectRepository, "createProject").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel))
    jest.spyOn(mockInstrumentModelRepository, "getInstrumentByName").mockImplementation(() => Promise.resolve(instrument_model_response))
    jest.spyOn(mockUserRepository, "ensureTypedUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "ensurePrivilegeCoherence").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "formatProjectRequestCreationModel").mockImplementation(() => projectRequestCreationModelForRepository)
    jest.spyOn(mockPrivilegeRepository, "createPrivileges").mockImplementation(() => Promise.resolve(0))
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementation(() => projectResponseModel)
    jest.spyOn(mockProjectRepository, "createProjectRootFolder").mockImplementation(() => Promise.resolve())

    const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository, mockEcotaxaAccountRepository, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_IMPORT)

    await expect(createProjectUseCase.execute(current_user, InputData)).rejects.toThrowError(outputError);


    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledWith(current_user.user_id);
    expect(mockProjectRepository.computeDefaultDepthOffset).not.toBeCalled();
    expect(mockProjectRepository.createProject).toHaveBeenCalledWith(projectRequestCreationModelForRepository);
    expect(mockProjectRepository.getProject).toHaveBeenCalledWith({ project_id: 1 });
});
test("Create project but something went wrong when fetching created privileges", async () => {
    const InputData: PublicProjectRequestCreationModel = projectRequestCreationModel
    const current_user: UserUpdateModel = {
        user_id: 1
    }
    const outputError = new Error("Cant find created privileges, please check members, managers and contact")

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "computeDefaultDepthOffset")
    jest.spyOn(mockProjectRepository, "createProject").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(projectResponseModel))
    jest.spyOn(mockInstrumentModelRepository, "getInstrumentByName").mockImplementation(() => Promise.resolve(instrument_model_response))
    jest.spyOn(mockUserRepository, "ensureTypedUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockPrivilegeRepository, "ensurePrivilegeCoherence").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockProjectRepository, "formatProjectRequestCreationModel").mockImplementation(() => projectRequestCreationModelForRepository)
    jest.spyOn(mockPrivilegeRepository, "createPrivileges").mockImplementation(() => Promise.resolve(2))
    jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve(publicPrivileges))
    jest.spyOn(mockProjectRepository, "toPublicProject").mockImplementation(() => projectResponseModel)
    jest.spyOn(mockProjectRepository, "createProjectRootFolder").mockImplementation(() => Promise.resolve())

    const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository, mockEcotaxaAccountRepository, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_IMPORT)

    await expect(createProjectUseCase.execute(current_user, InputData)).rejects.toThrowError(outputError);

    expect(mockUserRepository.ensureUserCanBeUsed).toHaveBeenCalledWith(current_user.user_id);
    expect(mockProjectRepository.computeDefaultDepthOffset).not.toBeCalled();
    expect(mockProjectRepository.createProject).toHaveBeenCalledWith(projectRequestCreationModelForRepository);
    expect(mockProjectRepository.getProject).toHaveBeenCalledWith({ project_id: 1 });
});
test("Refuses a root folder outside the import folder before creating anything", async () => {
    const InputData: PublicProjectRequestCreationModel = { ...projectRequestCreationModel, root_folder_path: "../sqlite_db" }
    const current_user: UserUpdateModel = { user_id: 1 }

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementationOnce(() => Promise.resolve())
    jest.spyOn(mockInstrumentModelRepository, "getInstrumentByName")
    jest.spyOn(mockProjectRepository, "createProject")

    const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository, mockEcotaxaAccountRepository, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_IMPORT)

    await expect(createProjectUseCase.execute(current_user, InputData)).rejects.toThrow("Root folder path must stay inside the import folder");
    expect(mockInstrumentModelRepository.getInstrumentByName).toBeCalledTimes(0);
    expect(mockProjectRepository.createProject).toBeCalledTimes(0);
});

describe("Accounts named by the project", () => {
    const named_project: ProjectResponseModel = { ...projectResponseModel, data_owner_email: "owner@lov.fr", operator_email: "op@lov.fr", chief_scientist_email: "owner@lov.fr" }
    const account = (user_id: number, email: string, valid_email: boolean) =>
        ({ user_id, email, valid_email, first_name: "F", last_name: "L", is_admin: false, organisation: "LOV", country: "FR", user_planned_usage: "", user_creation_utc_date_time: "2023-08-01 10:30:00" })

    beforeEach(() => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockProjectRepository, "createProject").mockResolvedValue(1)
        jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(named_project)
        jest.spyOn(mockInstrumentModelRepository, "getInstrumentByName").mockResolvedValue(instrument_model_response)
        jest.spyOn(mockUserRepository, "ensureTypedUserCanBeUsed").mockResolvedValue()
        jest.spyOn(mockPrivilegeRepository, "ensurePrivilegeCoherence").mockImplementation(() => undefined)
        jest.spyOn(mockProjectRepository, "formatProjectRequestCreationModel").mockReturnValue(projectRequestCreationModelForRepository)
        jest.spyOn(mockPrivilegeRepository, "createPrivileges").mockResolvedValue(2)
        jest.spyOn(mockProjectRepository, "toPublicProject").mockReturnValue(projectResponseModel)
        jest.spyOn(mockProjectRepository, "createProjectRootFolder").mockResolvedValue()
        jest.spyOn(mockPrivilegeRepository, "addPrivilege").mockResolvedValue(1)
    })

    test("Validated accounts named by the project join it and are returned with its privileges", async () => {
        const refreshed = { ...publicPrivileges_WithMemberAndManager, members: [...publicPrivileges_WithMemberAndManager.members, { user_id: 8, user_name: "op", email: "op@lov.fr" }] }
        jest.spyOn(mockUserRepository, "getUser").mockImplementation(async ({ email }) =>
            email === "owner@lov.fr" ? account(7, "owner@lov.fr", true) : account(8, "op@lov.fr", true))
        jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges")
            .mockResolvedValueOnce(publicPrivileges_WithMemberAndManager)
            .mockResolvedValueOnce(refreshed)

        const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository, mockEcotaxaAccountRepository, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_IMPORT)
        await createProjectUseCase.execute({ user_id: 1 }, projectRequestCreationModel)

        expect(mockUserRepository.getUser).toBeCalledTimes(2)
        expect(mockPrivilegeRepository.addPrivilege).toBeCalledTimes(1)
        expect(mockPrivilegeRepository.addPrivilege).toBeCalledWith({ user_id: 8, project_id: 1, privilege_name: "member", contact: false })
        expect(mockProjectRepository.toPublicProject).toBeCalledWith(named_project, refreshed)
    })

    test("An account whose email is not validated does not join", async () => {
        jest.spyOn(mockUserRepository, "getUser").mockResolvedValue(account(8, "op@lov.fr", false))
        jest.spyOn(mockPrivilegeRepository, "isGranted")
        jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockResolvedValue(publicPrivileges_WithMemberAndManager)

        const createProjectUseCase = new CreateProject(mockUserRepository, mockProjectRepository, mockInstrumentModelRepository, mockPrivilegeRepository, mockEcotaxaAccountRepository, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_IMPORT)
        await createProjectUseCase.execute({ user_id: 1 }, projectRequestCreationModel)

        expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(0)
        expect(mockPrivilegeRepository.addPrivilege).toBeCalledTimes(0)
        expect(mockPrivilegeRepository.getPublicPrivileges).toBeCalledTimes(1)
    })
})
