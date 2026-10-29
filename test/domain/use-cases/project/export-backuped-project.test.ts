import path from "path";

import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";

import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockUserRepository } from "../../../mocks/user-mock";
import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { ExportBackupedProjectUseCase } from "../../../../src/domain/interfaces/use-cases/project/export-backuped-project";
import { ExportBackupedProject } from "../../../../src/domain/use-cases/project/export-backuped-project";
import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { private_projectResponseModel } from "../../../entities/project";
import { TaskResponseModel_1, toPublicTask } from "../../../entities/task";
import { TASK_CANCELLED_MESSAGE } from "../../../../src/domain/constants/task";
// import { ProjectResponseModel } from "../../../../src/domain/entities/project";
// import { private_projectResponseModel } from "../../../entities/project";
// import { task_status_1_search_result, task_type_1_search_result, TaskResponseModel_1 } from "../../../entities/task";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

let mockUserRepository: UserRepository;
let mockTaskRepository: TaskRepository;
let mockProjectRepository: ProjectRepository;
let mockPrivilegeRepository: MockPrivilegeRepository;
let DATA_STORAGE_FS_STORAGE: string;
let backupProjectUseCase: ExportBackupedProjectUseCase;
let DATA_STORAGE_EXPORT: string;
let base_url_path: string;

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()
    mockProjectRepository = new MockProjectRepository()
    mockTaskRepository = new MockTaskRepository()
    DATA_STORAGE_FS_STORAGE = "data_storage/files_system_storage/"
    DATA_STORAGE_EXPORT = "data_storage/ecopart_exported_data/"
    base_url_path = "http://localhost:3000"

    backupProjectUseCase = new ExportBackupedProject(mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_EXPORT, base_url_path)
    jest.spyOn(mockTaskRepository, "toPublicTask").mockImplementation(toPublicTask)
    jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValue()
})
describe("ExportBackupedProjectUseCase", () => {
    describe("befor fier and forgot steps", () => {
        test("user should not be able to export the backup while a backup task is active on the project : refused before any task is created", async () => {
            const current_user: UserUpdateModel = { user_id: 1 }
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue()
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false)
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(true)
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(private_projectResponseModel)
            jest.spyOn(mockTaskRepository, "createTaskUnlessActive").mockResolvedValue(null)
            jest.spyOn(mockTaskRepository, "getOneTask")

            await expect(backupProjectUseCase.execute(current_user, 1, false)).rejects.toThrow("A backup task is already running for this project")

            expect(mockTaskRepository.createTaskUnlessActive).toBeCalledWith(expect.objectContaining({ task_project_id: private_projectResponseModel.project_id }), ["IMPORT_BACKUP", "EXPORT_BACKUP"])
            expect(mockTaskRepository.getOneTask).toBeCalledTimes(0)
        });
        test("deleted or invalid user should not be able to perform export backup on a project", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const project_id = 1
            const out_to_ftp = false
            const outputError = new Error("User cannot be used")


            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(outputError))
            jest.spyOn(mockUserRepository, "isAdmin")
            jest.spyOn(mockPrivilegeRepository, "isGranted")
            jest.spyOn(mockProjectRepository, "getProject")
            jest.spyOn(mockTaskRepository, "createTaskUnlessActive")
            jest.spyOn(mockTaskRepository, "getOneTask")
            // fier and forgot steps
            jest.spyOn(mockTaskRepository, "startTask")
            jest.spyOn(mockTaskRepository, "updateTaskProgress")
            jest.spyOn(mockProjectRepository, "ensureBackupExist")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFs")
            jest.spyOn(mockTaskRepository, "logMessage")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFtp")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockTaskRepository, "finishTask")
            jest.spyOn(mockTaskRepository, "failedTask")


            await expect(backupProjectUseCase.execute(current_user, project_id, out_to_ftp)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1)
            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0)
            expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(0)
            expect(mockProjectRepository.getProject).toBeCalledTimes(0)
            expect(mockTaskRepository.createTaskUnlessActive).toBeCalledTimes(0)
            expect(mockTaskRepository.getOneTask).toBeCalledTimes(0)
            // fier and forgot steps
            expect(mockTaskRepository.startTask).toBeCalledTimes(0)
            expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0)
            expect(mockProjectRepository.ensureBackupExist).toBeCalledTimes(0)
            expect(mockProjectRepository.exportBackupedProjectToFs).toBeCalledTimes(0)
            expect(mockTaskRepository.logMessage).toBeCalledTimes(0)
            expect(mockProjectRepository.exportBackupedProjectToFtp).toBeCalledTimes(0)
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0)
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0)
        });
        test("user should not be able to export backup on a project if he does not have the privilege", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const project_id = 1
            const out_to_ftp = false
            const outputError = new Error("Logged user cannot list importable samples in this project")


            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockProjectRepository, "getProject")
            jest.spyOn(mockTaskRepository, "createTaskUnlessActive")
            jest.spyOn(mockTaskRepository, "getOneTask")
            // fier and forgot steps
            jest.spyOn(mockTaskRepository, "startTask")
            jest.spyOn(mockTaskRepository, "updateTaskProgress")
            jest.spyOn(mockProjectRepository, "ensureBackupExist")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFs")
            jest.spyOn(mockTaskRepository, "logMessage")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFtp")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockTaskRepository, "finishTask")
            jest.spyOn(mockTaskRepository, "failedTask")


            await expect(backupProjectUseCase.execute(current_user, project_id, out_to_ftp)).rejects.toThrow(outputError)

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1)
            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id)
            expect(mockUserRepository.isAdmin).toBeCalledTimes(1)
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id)
            expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(1)
            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: project_id })
            expect(mockProjectRepository.getProject).toBeCalledTimes(0)
            expect(mockTaskRepository.createTaskUnlessActive).toBeCalledTimes(0)
            expect(mockTaskRepository.getOneTask).toBeCalledTimes(0)
            // fier and forgot steps
            expect(mockTaskRepository.startTask).toBeCalledTimes(0)
            expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0)
            expect(mockProjectRepository.ensureBackupExist).toBeCalledTimes(0)
            expect(mockProjectRepository.exportBackupedProjectToFs).toBeCalledTimes(0)
            expect(mockTaskRepository.logMessage).toBeCalledTimes(0)
            expect(mockProjectRepository.exportBackupedProjectToFtp).toBeCalledTimes(0)
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0)
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0)
        });

        test("user should not be able to backup project if cannot find project", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const project_id = 1
            const out_to_ftp = false

            const outputError = new Error("Cannot find project")

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true))
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(null))
            jest.spyOn(mockTaskRepository, "createTaskUnlessActive")
            jest.spyOn(mockTaskRepository, "getOneTask")
            // fier and forgot steps
            jest.spyOn(mockTaskRepository, "startTask")
            jest.spyOn(mockTaskRepository, "updateTaskProgress")
            jest.spyOn(mockProjectRepository, "ensureBackupExist")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFs")
            jest.spyOn(mockTaskRepository, "logMessage")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFtp")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockTaskRepository, "finishTask")
            jest.spyOn(mockTaskRepository, "failedTask")


            await expect(backupProjectUseCase.execute(current_user, project_id, out_to_ftp)).rejects.toThrow(outputError)

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
            // fier and forgot steps
            expect(mockTaskRepository.startTask).toBeCalledTimes(0)
            expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0)
            expect(mockProjectRepository.ensureBackupExist).toBeCalledTimes(0)
            expect(mockProjectRepository.exportBackupedProjectToFs).toBeCalledTimes(0)
            expect(mockTaskRepository.logMessage).toBeCalledTimes(0)
            expect(mockProjectRepository.exportBackupedProjectToFtp).toBeCalledTimes(0)
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0)
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0)
        });
        test("user should not be able to export backup project if cannot create task", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const project_id = 1
            const out_to_ftp = false

            const outputError = new Error("Any error")

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true))
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(private_projectResponseModel))
            jest.spyOn(mockTaskRepository, "createTaskUnlessActive").mockImplementation(() => Promise.reject(outputError))
            jest.spyOn(mockTaskRepository, "getOneTask")
            // fier and forgot steps
            jest.spyOn(mockTaskRepository, "startTask")
            jest.spyOn(mockTaskRepository, "updateTaskProgress")
            jest.spyOn(mockProjectRepository, "ensureBackupExist")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFs")
            jest.spyOn(mockTaskRepository, "logMessage")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFtp")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockTaskRepository, "finishTask")
            jest.spyOn(mockTaskRepository, "failedTask")


            await expect(backupProjectUseCase.execute(current_user, project_id, out_to_ftp)).rejects.toThrow(outputError)

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
                task_type: "EXPORT_BACKUP",
                task_status: "PENDING",
                task_owner_id: current_user.user_id,
                task_project_id: project_id,
                task_params: {
                    out_to_ftp
                }
            }, ["IMPORT_BACKUP", "EXPORT_BACKUP"])
            expect(mockTaskRepository.getOneTask).toBeCalledTimes(0)
            // fier and forgot steps
            expect(mockTaskRepository.startTask).toBeCalledTimes(0)
            expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0)
            expect(mockProjectRepository.ensureBackupExist).toBeCalledTimes(0)
            expect(mockProjectRepository.exportBackupedProjectToFs).toBeCalledTimes(0)
            expect(mockTaskRepository.logMessage).toBeCalledTimes(0)
            expect(mockProjectRepository.exportBackupedProjectToFtp).toBeCalledTimes(0)
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0)
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0)
        });
        test("user should not be able to export backup project if cannot find task", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const project_id = 1
            const out_to_ftp = false

            const outputError = new Error("Cannot find task")

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true))
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(private_projectResponseModel))
            jest.spyOn(mockTaskRepository, "createTaskUnlessActive").mockImplementation(() => Promise.resolve(1))
            jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(null))
            // fier and forgot steps
            jest.spyOn(mockTaskRepository, "startTask")
            jest.spyOn(mockTaskRepository, "updateTaskProgress")
            jest.spyOn(mockProjectRepository, "ensureBackupExist")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFs")
            jest.spyOn(mockTaskRepository, "logMessage")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFtp")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockTaskRepository, "finishTask")
            jest.spyOn(mockTaskRepository, "failedTask")


            await expect(backupProjectUseCase.execute(current_user, project_id, out_to_ftp)).rejects.toThrow(outputError)

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
                task_type: "EXPORT_BACKUP",
                task_status: "PENDING",
                task_owner_id: current_user.user_id,
                task_project_id: project_id,
                task_params: {
                    out_to_ftp
                }
            }, ["IMPORT_BACKUP", "EXPORT_BACKUP"])
            expect(mockTaskRepository.getOneTask).toBeCalledTimes(1)
            expect(mockTaskRepository.getOneTask).toBeCalledWith({ task_id: 1 })
            // fier and forgot steps
            expect(mockTaskRepository.startTask).toBeCalledTimes(0)
            expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0)
            expect(mockProjectRepository.ensureBackupExist).toBeCalledTimes(0)
            expect(mockProjectRepository.exportBackupedProjectToFs).toBeCalledTimes(0)
            expect(mockTaskRepository.logMessage).toBeCalledTimes(0)
            expect(mockProjectRepository.exportBackupedProjectToFtp).toBeCalledTimes(0)
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0)
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0)
        });
        test("user should be able to export backuped project, runs all steps before fier and forgot sucessfully", async () => {
            const current_user: UserUpdateModel = {
                user_id: 1,
            }
            const project_id = 1
            const out_to_ftp = false

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve())
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false))
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true))
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(private_projectResponseModel))
            jest.spyOn(mockTaskRepository, "createTaskUnlessActive").mockImplementation(() => Promise.resolve(1))
            jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1))
            // fier and forgot steps
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue()
            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue()
            jest.spyOn(mockProjectRepository, "ensureBackupExist").mockResolvedValue()
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFs").mockResolvedValue("path/to/backup")
            jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue()
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFtp").mockResolvedValue("path/to/backup")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue()
            jest.spyOn(mockTaskRepository, "failedTask")


            // The server path of the log file is not returned
            await expect(backupProjectUseCase.execute(current_user, project_id, out_to_ftp)).resolves.toStrictEqual(toPublicTask(TaskResponseModel_1))

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
                task_type: "EXPORT_BACKUP",
                task_status: "PENDING",
                task_owner_id: current_user.user_id,
                task_project_id: project_id,
                task_params: {
                    out_to_ftp
                }
            }, ["IMPORT_BACKUP", "EXPORT_BACKUP"])
            expect(mockTaskRepository.getOneTask).toBeCalledTimes(1)
        });
    });
    describe("fier and forgot steps", () => {
        test("user should be able to backup project, runs all fier and forgot steps sucessfully : export to FS", async () => {
            const out_to_ftp = false
            // fier and forgot steps
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue()
            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue()
            jest.spyOn(mockProjectRepository, "ensureBackupExist").mockResolvedValue()
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFs").mockResolvedValue(path.join(PROJECT_ROOT, "data_storage", "tasks", "1", "ecopart_export_backup_1.zip"))
            jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue()
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFtp").mockResolvedValue("path/to/backup")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue()
            jest.spyOn(mockTaskRepository, "failedTask")

            const bp = new ExportBackupedProject(mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_EXPORT, base_url_path)
            await (bp as any).startExportBackupedProjectTask(
                TaskResponseModel_1, private_projectResponseModel, out_to_ftp
            );

            expect(mockTaskRepository.startTask).toBeCalledTimes(1)
            expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(4)
            expect(mockProjectRepository.ensureBackupExist).toBeCalledTimes(1)
            expect(mockProjectRepository.exportBackupedProjectToFs).toBeCalledTimes(1)
            expect(mockTaskRepository.logMessage).toBeCalledTimes(2)
            // Relative to the application root: the task log never shows the server layout
            expect(mockTaskRepository.logMessage).toBeCalledWith(TaskResponseModel_1.task_log_file_path, "Exported at : data_storage/tasks/1/ecopart_export_backup_1.zip")
            // The mocked archive does not exist on disk: its size is reported unknown, the export still succeeds
            expect(mockTaskRepository.logMessage).toBeCalledWith(TaskResponseModel_1.task_log_file_path, "Archive : ecopart_export_backup_1.zip written, size unknown")
            expect(mockProjectRepository.exportBackupedProjectToFtp).toBeCalledTimes(0)
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1)
            // The download link points to the route that serves the task's archive
            expect(mockTaskRepository.finishTask).toBeCalledWith({ task_id: TaskResponseModel_1.task_id }, "http://localhost:3000/api/tasks/1/file")
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0)
        });
        test("user should be able to backup project, runs all fier and forgot steps sucessfully : more over export to FTP", async () => {
            const out_to_ftp = true
            // fier and forgot steps
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue()
            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue()
            jest.spyOn(mockProjectRepository, "ensureBackupExist").mockResolvedValue()
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFs").mockResolvedValue("path/to/backup")
            jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue()
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFtp").mockResolvedValue("1/ecopart_export_backup_1.zip")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue()
            jest.spyOn(mockTaskRepository, "failedTask")

            const bp = new ExportBackupedProject(mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_EXPORT, base_url_path)
            await (bp as any).startExportBackupedProjectTask(
                TaskResponseModel_1, private_projectResponseModel, out_to_ftp
            );

            expect(mockTaskRepository.startTask).toBeCalledTimes(1)
            expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(6)
            expect(mockProjectRepository.ensureBackupExist).toBeCalledTimes(1)
            expect(mockProjectRepository.exportBackupedProjectToFs).toBeCalledTimes(1)
            expect(mockTaskRepository.logMessage).toBeCalledTimes(3)
            // The path inside the FTP export folder, the one an FTP user reaches
            expect(mockTaskRepository.logMessage).toBeCalledWith(TaskResponseModel_1.task_log_file_path, "Exported to the FTP export folder at : 1/ecopart_export_backup_1.zip")
            expect(mockProjectRepository.exportBackupedProjectToFtp).toBeCalledTimes(1)
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1)
            expect(mockTaskRepository.finishTask).toBeCalledWith({ task_id: TaskResponseModel_1.task_id }, "1/ecopart_export_backup_1.zip http://localhost:3000/api/tasks/1/file")
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0)
        });
        test("a cancellation requested during the validation stops the export before the archive is built", async () => {
            const cancelled = new Error(TASK_CANCELLED_MESSAGE)
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue()
            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue()
            jest.spyOn(mockProjectRepository, "ensureBackupExist").mockResolvedValue()
            jest.spyOn(mockTaskRepository, "throwIfCancelled").mockRejectedValue(cancelled)
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFs")
            jest.spyOn(mockTaskRepository, "finishTask")
            jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue()

            const bp = new ExportBackupedProject(mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_EXPORT, base_url_path)
            await (bp as any).startExportBackupedProjectTask(TaskResponseModel_1, private_projectResponseModel, false);

            expect(mockProjectRepository.exportBackupedProjectToFs).toBeCalledTimes(0)
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0)
            expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, cancelled)
        });
        test("user should not be able to export backup if no backup exist for this project", async () => {
            const out_to_ftp = true
            // fier and forgot steps
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue()
            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue()
            jest.spyOn(mockProjectRepository, "ensureBackupExist").mockRejectedValue(new Error("Backup folder does not exist at path: data_storage/files_system_storage/1/backup"))
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFs")
            jest.spyOn(mockTaskRepository, "logMessage")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockProjectRepository, "exportBackupedProjectToFtp")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            // jest.spyOn(mockTaskRepository,"updateTaskProgress")
            jest.spyOn(mockTaskRepository, "finishTask")
            jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue()

            const bp = new ExportBackupedProject(mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_EXPORT, base_url_path)
            await (bp as any).startExportBackupedProjectTask(
                TaskResponseModel_1, private_projectResponseModel, out_to_ftp
            );

            expect(mockTaskRepository.startTask).toBeCalledTimes(1)
            expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(1)
            expect(mockProjectRepository.ensureBackupExist).toBeCalledTimes(1)
            expect(mockProjectRepository.exportBackupedProjectToFs).toBeCalledTimes(0)
            expect(mockTaskRepository.logMessage).toBeCalledTimes(0)
            expect(mockProjectRepository.exportBackupedProjectToFtp).toBeCalledTimes(0)
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0)
            expect(mockTaskRepository.failedTask).toBeCalledTimes(1)
        });
    });
});
