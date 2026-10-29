import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";

import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockUserRepository } from "../../../mocks/user-mock";
import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { BackupProjectUseCase } from "../../../../src/domain/interfaces/use-cases/project/backup-project";
import { BackupProject } from "../../../../src/domain/use-cases/project/backup-project";
import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { ProjectResponseModel } from "../../../../src/domain/entities/project";
import { private_projectResponseModel } from "../../../entities/project";
import { TaskResponseModel_1, toPublicTask } from "../../../entities/task";
import { TASK_CANCELLED_MESSAGE } from "../../../../src/domain/constants/task";

let mockUserRepository: UserRepository;
let mockTaskRepository: TaskRepository;
let mockProjectRepository: ProjectRepository;
let mockPrivilegeRepository: MockPrivilegeRepository;
let DATA_STORAGE_FS_STORAGE: string;
let backupProjectUseCase: BackupProjectUseCase;



beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()
    mockProjectRepository = new MockProjectRepository()
    mockTaskRepository = new MockTaskRepository()
    DATA_STORAGE_FS_STORAGE = "data_storage/files_system_storage/"
    backupProjectUseCase = new BackupProject(mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE)
    jest.spyOn(mockTaskRepository, "toPublicTask").mockImplementation(toPublicTask)
    jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValue()
})

test("deleted or invalid user should not be able to perform backup on projects", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1,
    }
    const project_id = 1
    const skip_already_imported = false

    const outputError = new Error("User cannot be used")

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(outputError))
    jest.spyOn(mockUserRepository, "isAdmin")
    jest.spyOn(mockPrivilegeRepository, "isGranted")
    jest.spyOn(mockProjectRepository, "getProject")
    jest.spyOn(mockTaskRepository, "createTaskUnlessActive")
    jest.spyOn(mockTaskRepository, "getOneTask")
    jest.spyOn(mockTaskRepository, "startTask")
    jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockTaskRepository, "standardGetTaskType")
    jest.spyOn(mockTaskRepository, "standardGetTaskStatus")
    //jest.spyOn(mockTaskRepository, "getOneTask")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockProjectRepository, "ensureFolderStructureForBackup")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockProjectRepository, "copyL0bToProjectFolder")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockTaskRepository, "finishTask")
    jest.spyOn(mockTaskRepository, "failedTask")


    await expect(backupProjectUseCase.execute(current_user, project_id, skip_already_imported)).rejects.toThrow(outputError)

    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1)
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
    expect(mockUserRepository.isAdmin).toBeCalledTimes(0)
    expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(0)
    expect(mockProjectRepository.getProject).toBeCalledTimes(0)
    expect(mockTaskRepository.createTaskUnlessActive).toBeCalledTimes(0)
    expect(mockTaskRepository.getOneTask).toBeCalledTimes(0)
    expect(mockTaskRepository.startTask).toBeCalledTimes(0)
    expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0)
    expect(mockTaskRepository.standardGetTaskType).toBeCalledTimes(0)
    expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(0)
    expect(mockProjectRepository.ensureFolderStructureForBackup).toBeCalledTimes(0)
    expect(mockProjectRepository.copyL0bToProjectFolder).toBeCalledTimes(0)
    expect(mockTaskRepository.finishTask).toBeCalledTimes(0)
    expect(mockTaskRepository.failedTask).toBeCalledTimes(0)
});

test("user should not be able to backup project if he does not have the privilege", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1,
    }
    const project_id = 1
    const skip_already_imported = false

    const outputError = new Error("Logged user cannot list importable samples in this project")

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(false))
    jest.spyOn(mockProjectRepository, "getProject")
    jest.spyOn(mockTaskRepository, "createTaskUnlessActive")
    jest.spyOn(mockTaskRepository, "getOneTask")
    jest.spyOn(mockTaskRepository, "startTask")
    jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockTaskRepository, "standardGetTaskType")
    jest.spyOn(mockTaskRepository, "standardGetTaskStatus")
    //jest.spyOn(mockTaskRepository, "getOneTask")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockProjectRepository, "ensureFolderStructureForBackup")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockProjectRepository, "copyL0bToProjectFolder")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockTaskRepository, "finishTask")
    jest.spyOn(mockTaskRepository, "failedTask")


    await expect(backupProjectUseCase.execute(current_user, project_id, skip_already_imported)).rejects.toThrow(outputError)

    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1)
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
    expect(mockUserRepository.isAdmin).toBeCalledTimes(1)
    expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id)
    expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(1)
    expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: project_id })


    expect(mockProjectRepository.getProject).toBeCalledTimes(0)
    expect(mockTaskRepository.createTaskUnlessActive).toBeCalledTimes(0)
    expect(mockTaskRepository.getOneTask).toBeCalledTimes(0)
    expect(mockTaskRepository.startTask).toBeCalledTimes(0)
    expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0)
    expect(mockTaskRepository.standardGetTaskType).toBeCalledTimes(0)
    expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(0)
    expect(mockProjectRepository.ensureFolderStructureForBackup).toBeCalledTimes(0)
    expect(mockProjectRepository.copyL0bToProjectFolder).toBeCalledTimes(0)
    expect(mockTaskRepository.finishTask).toBeCalledTimes(0)
    expect(mockTaskRepository.failedTask).toBeCalledTimes(0)
});

test("user should not be able to backup project if cannot find project", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1,
    }
    const project_id = 1
    const skip_already_imported = false

    const outputError = new Error("Cannot find project")

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true))
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(null))
    jest.spyOn(mockTaskRepository, "createTaskUnlessActive")
    jest.spyOn(mockTaskRepository, "getOneTask")
    jest.spyOn(mockTaskRepository, "startTask")
    jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockTaskRepository, "standardGetTaskType")
    jest.spyOn(mockTaskRepository, "standardGetTaskStatus")
    //jest.spyOn(mockTaskRepository, "getOneTask")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockProjectRepository, "ensureFolderStructureForBackup")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockProjectRepository, "copyL0bToProjectFolder")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockTaskRepository, "finishTask")
    jest.spyOn(mockTaskRepository, "failedTask")


    await expect(backupProjectUseCase.execute(current_user, project_id, skip_already_imported)).rejects.toThrow(outputError)

    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1)
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
    expect(mockUserRepository.isAdmin).toBeCalledTimes(1)
    expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id)
    expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(1)
    expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: project_id })
    expect(mockProjectRepository.getProject).toBeCalledTimes(1)
    expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: project_id })


    expect(mockTaskRepository.createTaskUnlessActive).toBeCalledTimes(0)
    expect(mockTaskRepository.getOneTask).toBeCalledTimes(0)
    expect(mockTaskRepository.startTask).toBeCalledTimes(0)
    expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0)
    expect(mockTaskRepository.standardGetTaskType).toBeCalledTimes(0)
    expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(0)
    expect(mockProjectRepository.ensureFolderStructureForBackup).toBeCalledTimes(0)
    expect(mockProjectRepository.copyL0bToProjectFolder).toBeCalledTimes(0)
    expect(mockTaskRepository.finishTask).toBeCalledTimes(0)
    expect(mockTaskRepository.failedTask).toBeCalledTimes(0)
});

test("user should not be able to backup project if cannot createTask", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1,
    }
    const project_id = 1
    const skip_already_imported = false
    const project: ProjectResponseModel = private_projectResponseModel

    const outputError = new Error("Any error")

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true))
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(project))
    jest.spyOn(mockTaskRepository, "createTaskUnlessActive").mockImplementation(() => Promise.reject(outputError))
    jest.spyOn(mockTaskRepository, "getOneTask")
    jest.spyOn(mockTaskRepository, "startTask")
    jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockTaskRepository, "standardGetTaskType")
    jest.spyOn(mockTaskRepository, "standardGetTaskStatus")
    //jest.spyOn(mockTaskRepository, "getOneTask")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockProjectRepository, "ensureFolderStructureForBackup")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockProjectRepository, "copyL0bToProjectFolder")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockTaskRepository, "finishTask")
    jest.spyOn(mockTaskRepository, "failedTask")


    await expect(backupProjectUseCase.execute(current_user, project_id, skip_already_imported)).rejects.toThrow(outputError)

    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1)
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
    expect(mockUserRepository.isAdmin).toBeCalledTimes(1)
    expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id)
    expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(1)
    expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: project_id })
    expect(mockProjectRepository.getProject).toBeCalledTimes(1)
    expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: project_id })
    expect(mockTaskRepository.createTaskUnlessActive).toBeCalledTimes(1)
    expect(mockTaskRepository.createTaskUnlessActive).toBeCalledWith({
        task_type: "IMPORT_BACKUP",
        task_status: "PENDING",
        task_owner_id: current_user.user_id,
        task_project_id: project_id,
        task_params: {
            root_folder_path: project.root_folder_path,
            skip_already_imported: skip_already_imported
        }
    }, ["IMPORT_BACKUP", "EXPORT_BACKUP"])

    expect(mockTaskRepository.getOneTask).toBeCalledTimes(0)
    expect(mockTaskRepository.startTask).toBeCalledTimes(0)
    expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0)
    expect(mockTaskRepository.standardGetTaskType).toBeCalledTimes(0)
    expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(0)
    expect(mockProjectRepository.ensureFolderStructureForBackup).toBeCalledTimes(0)
    expect(mockProjectRepository.copyL0bToProjectFolder).toBeCalledTimes(0)
    expect(mockTaskRepository.finishTask).toBeCalledTimes(0)
    expect(mockTaskRepository.failedTask).toBeCalledTimes(0)
});

test("user should not be able to backup project if cannot find task", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1,
    }
    const project_id = 1
    const skip_already_imported = false
    const project: ProjectResponseModel = private_projectResponseModel

    const outputError = new Error("Cannot find task");

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true))
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(project))
    jest.spyOn(mockTaskRepository, "createTaskUnlessActive").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(null))
    jest.spyOn(mockTaskRepository, "startTask")
    jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockTaskRepository, "standardGetTaskType")
    jest.spyOn(mockTaskRepository, "standardGetTaskStatus")
    //jest.spyOn(mockTaskRepository, "getOneTask")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockProjectRepository, "ensureFolderStructureForBackup")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockProjectRepository, "copyL0bToProjectFolder")
    //jest.spyOn(mockTaskRepository, "updateTaskProgress")
    jest.spyOn(mockTaskRepository, "finishTask")
    jest.spyOn(mockTaskRepository, "failedTask")


    await expect(backupProjectUseCase.execute(current_user, project_id, skip_already_imported)).rejects.toThrow(outputError)

    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1)
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
    expect(mockUserRepository.isAdmin).toBeCalledTimes(1)
    expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id)
    expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(1)
    expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: project_id })
    expect(mockProjectRepository.getProject).toBeCalledTimes(1)
    expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: project_id })
    expect(mockTaskRepository.createTaskUnlessActive).toBeCalledTimes(1)
    expect(mockTaskRepository.createTaskUnlessActive).toBeCalledWith({
        task_type: "IMPORT_BACKUP",
        task_status: "PENDING",
        task_owner_id: current_user.user_id,
        task_project_id: project_id,
        task_params: {
            root_folder_path: project.root_folder_path,
            skip_already_imported: skip_already_imported
        }
    }, ["IMPORT_BACKUP", "EXPORT_BACKUP"])
    expect(mockTaskRepository.getOneTask).toBeCalledTimes(1)
    expect(mockTaskRepository.getOneTask).toBeCalledWith({ task_id: 1 })

    expect(mockTaskRepository.startTask).toBeCalledTimes(0)
    expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0)
    expect(mockTaskRepository.standardGetTaskType).toBeCalledTimes(0)
    expect(mockTaskRepository.standardGetTaskStatus).toBeCalledTimes(0)
    expect(mockProjectRepository.ensureFolderStructureForBackup).toBeCalledTimes(0)
    expect(mockProjectRepository.copyL0bToProjectFolder).toBeCalledTimes(0)
    expect(mockTaskRepository.finishTask).toBeCalledTimes(0)
    expect(mockTaskRepository.failedTask).toBeCalledTimes(0)
});

// TODO test the rest of errors of the async function

test("user should be able to backup project, runs all steps before fier and forgot sucessfully", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1,
    }
    const project_id = 1
    const skip_already_imported = false
    const project: ProjectResponseModel = private_projectResponseModel
    const task = TaskResponseModel_1

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true))
    jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(project))
    jest.spyOn(mockTaskRepository, "createTaskUnlessActive").mockImplementation(() => Promise.resolve(1))
    jest.spyOn(mockTaskRepository, "getOneTask").mockImplementationOnce(() => Promise.resolve(task))

    // in case async function have time to run some steps
    jest.spyOn(mockTaskRepository, "startTask").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue()
    jest.spyOn(mockProjectRepository, "ensureFolderStructureForBackup").mockResolvedValue()
    jest.spyOn(mockProjectRepository, "copyL0bToProjectFolder").mockResolvedValue()
    jest.spyOn(mockProjectRepository, "standardUpdateProject").mockResolvedValue(1)
    jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue()
    jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue()


    // The server path of the log file is not returned
    await expect(backupProjectUseCase.execute(current_user, project_id, skip_already_imported)).resolves.toStrictEqual(toPublicTask(task))

    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1)
    expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
    expect(mockUserRepository.isAdmin).toBeCalledTimes(1)
    expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id)
    expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(1)
    expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: project_id })
    expect(mockProjectRepository.getProject).toBeCalledTimes(1)
    expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: project_id })
    expect(mockTaskRepository.createTaskUnlessActive).toBeCalledTimes(1)
    expect(mockTaskRepository.createTaskUnlessActive).toBeCalledWith({
        task_type: "IMPORT_BACKUP",
        task_status: "PENDING",
        task_owner_id: current_user.user_id,
        task_project_id: project_id,
        task_params: {
            root_folder_path: project.root_folder_path,
            skip_already_imported: skip_already_imported
        }
    }, ["IMPORT_BACKUP", "EXPORT_BACKUP"])
    expect(mockTaskRepository.getOneTask).toBeCalledTimes(1)
    expect(mockTaskRepository.getOneTask).toBeCalledWith({ task_id: 1 })
});

// TODO test the rest of the fier and forgot steps
test("user should be able to backup project, runs all fier and forgot steps sucessfully", async () => {
    const skip_already_imported = false

    // Arrange ...
    jest.spyOn(mockTaskRepository, "startTask").mockImplementation(() => Promise.resolve())
    jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue()
    jest.spyOn(mockProjectRepository, "ensureFolderStructureForBackup").mockResolvedValue()
    // The repository reports each copy through the logger it is given
    jest.spyOn(mockProjectRepository, "copyL0bToProjectFolder").mockImplementation((async (_source: string, _dest: string, _skip: boolean, log: (message: string) => Promise<void>) => {
        await log("raw/r1/ zipped as raw/r1.zip (12 B)")
    }) as any)
    jest.spyOn(mockProjectRepository, "standardUpdateProject").mockResolvedValue(1)
    jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue()
    jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue()
    jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue()

    // Act
    const bp = new BackupProject(mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE)

    await (bp as any).startBackupProjectTask(
        TaskResponseModel_1, private_projectResponseModel, skip_already_imported
    );

    // Assert
    expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(4)
    expect(mockTaskRepository.throwIfCancelled).toBeCalledTimes(1)
    expect(mockProjectRepository.ensureFolderStructureForBackup).toBeCalledTimes(1)
    expect(mockProjectRepository.copyL0bToProjectFolder).toBeCalledTimes(1)
    expect((mockTaskRepository.logMessage as jest.Mock).mock.calls.map(([, message]) => message)).toEqual([
        `Step 2/2 L0-b backup folders copy : from ${private_projectResponseModel.root_folder_path} to ${DATA_STORAGE_FS_STORAGE}1/l0b_backup, every raw folder is written again`,
        "Step 2/2 L0-b backup folders copy : raw/r1/ zipped as raw/r1.zip (12 B)",
    ])
    expect(mockTaskRepository.finishTask).toBeCalledTimes(1)

    expect(mockTaskRepository.failedTask).toBeCalledTimes(0)
});

test("user should not be able to backup project while a backup task is active on it : refused before any task is created", async () => {
    const current_user: UserUpdateModel = {
        user_id: 1,
    }
    const project_id = 1
    const project: ProjectResponseModel = private_projectResponseModel

    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
    jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false)
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(true)
    jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(project)
    jest.spyOn(mockTaskRepository, "createTaskUnlessActive").mockResolvedValue(null)
    jest.spyOn(mockTaskRepository, "getOneTask")
    jest.spyOn(mockTaskRepository, "startTask")

    await expect(backupProjectUseCase.execute(current_user, project_id, false)).rejects.toThrow("A backup task is already running for this project")

    // Import and export of the backup block each other
    expect(mockTaskRepository.createTaskUnlessActive).toBeCalledWith(expect.objectContaining({ task_project_id: project.project_id }), ["IMPORT_BACKUP", "EXPORT_BACKUP"])
    expect(mockTaskRepository.getOneTask).toBeCalledTimes(0)
    expect(mockTaskRepository.startTask).toBeCalledTimes(0)
});

test("a cancellation requested during the validation stops the backup before the copy", async () => {
    const cancelled = new Error(TASK_CANCELLED_MESSAGE)

    jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue()
    jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue()
    jest.spyOn(mockProjectRepository, "ensureFolderStructureForBackup").mockResolvedValue()
    jest.spyOn(mockTaskRepository, "throwIfCancelled").mockRejectedValue(cancelled)
    jest.spyOn(mockProjectRepository, "copyL0bToProjectFolder")
    jest.spyOn(mockProjectRepository, "standardUpdateProject")
    jest.spyOn(mockTaskRepository, "finishTask")
    jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue()

    const bp = new BackupProject(mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE)
    await (bp as any).startBackupProjectTask(TaskResponseModel_1, private_projectResponseModel, false)

    expect(mockTaskRepository.throwIfCancelled).toBeCalledWith(TaskResponseModel_1.task_id)
    expect(mockProjectRepository.copyL0bToProjectFolder).toBeCalledTimes(0)
    expect(mockProjectRepository.standardUpdateProject).toBeCalledTimes(0)
    expect(mockTaskRepository.finishTask).toBeCalledTimes(0)
    expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, cancelled)
});
