import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { ImportSamples } from "../../../../src/domain/use-cases/sample/import-samples";
import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { projectResponseModel } from "../../../entities/project";
import { TaskResponseModel_1 } from "../../../entities/task";
import { listImportableSamplesResult, sampleRequestCreationModel_1 } from "../../../entities/sample";

let mockUserRepository: UserRepository;
let mockSampleRepository: SampleRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let mockProjectRepository: ProjectRepository;
let mockTaskRepository: TaskRepository;
let DATA_STORAGE_FS_STORAGE: string;
let importSamplesUseCase: ImportSamples;

beforeEach(async () => {
    jest.clearAllMocks();
    mockSampleRepository = new MockSampleRepository()
    mockUserRepository = new MockUserRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()
    mockProjectRepository = new MockProjectRepository()
    mockTaskRepository = new MockTaskRepository()
    DATA_STORAGE_FS_STORAGE = "data_storage/files_system_storage/"

    importSamplesUseCase = new ImportSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE)
})


describe("Delete Sample Use Case", () => {
    describe("test before fier and forget task", () => {
        describe("errors senarios", () => {
            test("should throw an error if the user is not valid", async () => {
                const current_user: UserUpdateModel = {
                    user_id: 1
                };

                const errorOutput = new Error("User cannot be used");

                jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(errorOutput));
                jest.spyOn(mockUserRepository, "isAdmin");
                jest.spyOn(mockPrivilegeRepository, "isGranted");
                jest.spyOn(mockProjectRepository, "getProject");
                jest.spyOn(mockTaskRepository, "createTask");
                jest.spyOn(mockTaskRepository, "getOneTask");
                // After fier and forget task is called
                jest.spyOn(mockTaskRepository, "startTask");
                jest.spyOn(mockSampleRepository, "ensureFolderExists");
                jest.spyOn(mockSampleRepository, "listImportableSamples");
                jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //ensureSamplesAreBothInHeadersAndInRawData
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder");
                jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockTaskRepository, "failedTask");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "formatSampleToImport");
                jest.spyOn(mockSampleRepository, "createManySamples");
                //jest.spyOn(mockTaskRepository, "//");
                jest.spyOn(mockTaskRepository, "finishTask");
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder");
                jest.spyOn(mockTaskRepository, "getTask");
                jest.spyOn(mockTaskRepository, "logMessage");
                //jest.spyOn(mockTaskRepository, "failedTask");


                await expect(importSamplesUseCase.execute(current_user, 1, ["sample1", "sample2"])).rejects.toThrow("User cannot be used");

                expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
                expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
                expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(0);
                expect(mockProjectRepository.getProject).toBeCalledTimes(0);
                expect(mockTaskRepository.createTask).toBeCalledTimes(0);
                expect(mockTaskRepository.getOneTask).toBeCalledTimes(0);
                // After fier and forget task is called
                expect(mockTaskRepository.startTask).toBeCalledTimes(0);
                expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(0);
                expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(0);
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(0);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(0);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.getTask).toBeCalledTimes(0);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(0);

            });
            test("should throw an error if the user is not an admin and does not have the privilege on the project", async () => {
                const current_user: UserUpdateModel = {
                    user_id: 1
                };

                const errorOutput = new Error("Logged user cannot list importable samples in this project");

                jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
                jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false));
                jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(false));
                jest.spyOn(mockProjectRepository, "getProject");
                jest.spyOn(mockTaskRepository, "createTask");
                jest.spyOn(mockTaskRepository, "getOneTask");
                // After fier and forget task is called
                jest.spyOn(mockTaskRepository, "startTask");
                jest.spyOn(mockSampleRepository, "ensureFolderExists");
                jest.spyOn(mockSampleRepository, "listImportableSamples");
                jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //ensureSamplesAreBothInHeadersAndInRawData
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder");
                jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockTaskRepository, "failedTask");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "formatSampleToImport");
                jest.spyOn(mockSampleRepository, "createManySamples");
                //jest.spyOn(mockTaskRepository, "//");
                jest.spyOn(mockTaskRepository, "finishTask");
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder");
                jest.spyOn(mockTaskRepository, "getTask");
                jest.spyOn(mockTaskRepository, "logMessage");
                //jest.spyOn(mockTaskRepository, "failedTask");

                await expect(importSamplesUseCase.execute(current_user, 1, ["sample1", "sample2"])).rejects.toThrow(errorOutput);

                expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
                expect(mockUserRepository.isAdmin).toBeCalledTimes(1);
                expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(1);
                expect(mockProjectRepository.getProject).toBeCalledTimes(0);
                expect(mockTaskRepository.createTask).toBeCalledTimes(0);
                expect(mockTaskRepository.getOneTask).toBeCalledTimes(0);
                // After fier and forget task is called
                expect(mockTaskRepository.startTask).toBeCalledTimes(0);
                expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(0);
                expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(0);
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(0);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(0);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.getTask).toBeCalledTimes(0);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(0);
            });
            test("should throw an error if Cannot find project", async () => {
                const current_user: UserUpdateModel = {
                    user_id: 1
                };

                const errorOutput = new Error("Cannot find project");
                jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
                jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
                jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true));
                jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(null);
                jest.spyOn(mockTaskRepository, "createTask");
                jest.spyOn(mockTaskRepository, "getOneTask");
                // After fier and forget task is called
                jest.spyOn(mockTaskRepository, "startTask");
                jest.spyOn(mockSampleRepository, "ensureFolderExists");
                jest.spyOn(mockSampleRepository, "listImportableSamples");
                jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //ensureSamplesAreBothInHeadersAndInRawData
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder");
                jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockTaskRepository, "failedTask");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "formatSampleToImport");
                jest.spyOn(mockSampleRepository, "createManySamples");
                //jest.spyOn(mockTaskRepository, "//");
                jest.spyOn(mockTaskRepository, "finishTask");
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder");
                jest.spyOn(mockTaskRepository, "getTask");
                jest.spyOn(mockTaskRepository, "logMessage");
                //jest.spyOn(mockTaskRepository, "failedTask");

                await expect(importSamplesUseCase.execute(current_user, 1, ["sample1", "sample2"])).rejects.toThrow(errorOutput);

                expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
                expect(mockUserRepository.isAdmin).toBeCalledTimes(1);
                expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(1);
                expect(mockProjectRepository.getProject).toBeCalledTimes(1);
                expect(mockTaskRepository.createTask).toBeCalledTimes(0);
                expect(mockTaskRepository.getOneTask).toBeCalledTimes(0);
                // After fier and forget task is called
                expect(mockTaskRepository.startTask).toBeCalledTimes(0);
                expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(0);
                expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(0);
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(0);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(0);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.getTask).toBeCalledTimes(0);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(0);
            });
            test("should throw an error if the task is not created", async () => {
                const current_user: UserUpdateModel = {
                    user_id: 1
                };

                const errorOutput = new Error("any error");

                jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
                jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
                jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true));
                jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(projectResponseModel);
                jest.spyOn(mockTaskRepository, "createTask").mockRejectedValue(errorOutput);
                jest.spyOn(mockTaskRepository, "getOneTask");
                // After fier and forget task is called
                jest.spyOn(mockTaskRepository, "startTask");
                jest.spyOn(mockSampleRepository, "ensureFolderExists");
                jest.spyOn(mockSampleRepository, "listImportableSamples");
                jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //ensureSamplesAreBothInHeadersAndInRawData
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder");
                jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockTaskRepository, "failedTask");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "formatSampleToImport");
                jest.spyOn(mockSampleRepository, "createManySamples");
                //jest.spyOn(mockTaskRepository, "//");
                jest.spyOn(mockTaskRepository, "finishTask");
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder");
                jest.spyOn(mockTaskRepository, "getTask");
                jest.spyOn(mockTaskRepository, "logMessage");
                //jest.spyOn(mockTaskRepository, "failedTask");

                await expect(importSamplesUseCase.execute(current_user, 1, ["sample1", "sample2"])).rejects.toThrow(errorOutput);

                expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
                expect(mockUserRepository.isAdmin).toBeCalledTimes(1);
                expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(1);
                expect(mockProjectRepository.getProject).toBeCalledTimes(1);
                expect(mockTaskRepository.createTask).toBeCalledTimes(1);
                expect(mockTaskRepository.getOneTask).toBeCalledTimes(0);
                // After fier and forget task is called
                expect(mockTaskRepository.startTask).toBeCalledTimes(0);
                expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(0);
                expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(0);
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(0);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(0);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.getTask).toBeCalledTimes(0);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(0);
            });
            test("should throw an error if the task is not found", async () => {
                const current_user: UserUpdateModel = {
                    user_id: 1
                };

                const errorOutput = new Error("Cannot find task");

                jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
                jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
                jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true));
                jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(projectResponseModel);
                jest.spyOn(mockTaskRepository, "createTask").mockResolvedValue(1);
                jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(null);
                // After fier and forget task is called
                jest.spyOn(mockTaskRepository, "startTask");
                jest.spyOn(mockSampleRepository, "ensureFolderExists");
                jest.spyOn(mockSampleRepository, "listImportableSamples");
                jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //ensureSamplesAreBothInHeadersAndInRawData
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder");
                jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockTaskRepository, "failedTask");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "formatSampleToImport");
                jest.spyOn(mockSampleRepository, "createManySamples");
                //jest.spyOn(mockTaskRepository, "//");
                jest.spyOn(mockTaskRepository, "finishTask");
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder");
                jest.spyOn(mockTaskRepository, "getTask");
                jest.spyOn(mockTaskRepository, "logMessage");
                //jest.spyOn(mockTaskRepository, "failedTask");

                await expect(importSamplesUseCase.execute(current_user, 1, ["sample1", "sample2"])).rejects.toThrow(errorOutput);

                expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
                expect(mockUserRepository.isAdmin).toBeCalledTimes(1);
                expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(1);
                expect(mockProjectRepository.getProject).toBeCalledTimes(1);
                expect(mockTaskRepository.createTask).toBeCalledTimes(1);
                expect(mockTaskRepository.getOneTask).toBeCalledTimes(1);
                // After fier and forget task is called
                expect(mockTaskRepository.startTask).toBeCalledTimes(0);
                expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(0);
                expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(0);
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(0);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(0);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.getTask).toBeCalledTimes(0);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(0);
            });
        });
        describe("success senarios", () => {
            test("should create a task and start it", async () => {
                const current_user: UserUpdateModel = {
                    user_id: 1
                };

                jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
                jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
                jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true));
                jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(projectResponseModel);
                jest.spyOn(mockTaskRepository, "createTask").mockResolvedValue(1);
                jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(TaskResponseModel_1);
                // After fier and forget task is called
                jest.spyOn(mockTaskRepository, "startTask").mockImplementation(() => Promise.resolve());
                jest.spyOn(mockSampleRepository, "ensureFolderExists").mockImplementation(() => Promise.resolve());
                jest.spyOn(mockSampleRepository, "listImportableSamples").mockImplementation(() => Promise.resolve(listImportableSamplesResult));
                jest.spyOn(mockTaskRepository, "updateTaskProgress").mockImplementation(() => Promise.resolve());
                //ensureSamplesAreBothInHeadersAndInRawData
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder").mockImplementation(() => Promise.resolve());
                jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder").mockImplementation(() => Promise.resolve());
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockTaskRepository, "failedTask").mockImplementation(() => Promise.resolve());
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "formatSampleToImport").mockImplementation(() => Promise.resolve(sampleRequestCreationModel_1));
                jest.spyOn(mockSampleRepository, "createManySamples").mockImplementation(() => Promise.resolve([1, 2]));
                //jest.spyOn(mockTaskRepository, "//");
                jest.spyOn(mockTaskRepository, "finishTask").mockImplementation(() => Promise.resolve());
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder").mockImplementation(() => Promise.resolve());
                jest.spyOn(mockTaskRepository, "getTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1));
                jest.spyOn(mockTaskRepository, "logMessage").mockImplementation(() => Promise.resolve());
                //jest.spyOn(mockTaskRepository, "failedTask");

                await expect(importSamplesUseCase.execute(current_user, 1, ["sample1", "sample2"])).resolves.toEqual(TaskResponseModel_1);

                expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
                expect(mockUserRepository.isAdmin).toBeCalledTimes(1);
                expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(1);
                expect(mockProjectRepository.getProject).toBeCalledTimes(1);
                expect(mockTaskRepository.createTask).toBeCalledTimes(1);
                expect(mockTaskRepository.getOneTask).toBeCalledTimes(1);
            });
        });
    });
    describe("test after fier and forget task", () => {
        describe("errors senarios", () => {
            test("should throw an error if startTask failed", async () => {
                const current_user: UserUpdateModel = {
                    user_id: 1
                };
                const is = new ImportSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE)

                const errorOutput = new Error("any error");

                jest.spyOn(mockTaskRepository, "startTask").mockRejectedValue(errorOutput);
                jest.spyOn(mockSampleRepository, "ensureFolderExists");
                jest.spyOn(mockSampleRepository, "listImportableSamples");
                jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //ensureSamplesAreBothInHeadersAndInRawData
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder");
                jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "formatSampleToImport");
                jest.spyOn(mockSampleRepository, "createManySamples");
                //jest.spyOn(mockTaskRepository, "//");
                jest.spyOn(mockTaskRepository, "finishTask");
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder");
                jest.spyOn(mockTaskRepository, "getTask");
                jest.spyOn(mockTaskRepository, "logMessage");
                //jest.spyOn(mockTaskRepository, "failedTask");

                await (is as any).startImportTask(TaskResponseModel_1, ["sample1", "sample2"], "UVP5HD", projectResponseModel, current_user.user_id)

                expect(mockTaskRepository.startTask).toBeCalledTimes(1);
                expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(0);
                expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(0);
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(1);
                expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, errorOutput);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(0);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(0);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.getTask).toBeCalledTimes(0);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(0);
            });
            test("should throw an error if folder doesnt exist", async () => {
                const current_user: UserUpdateModel = {
                    user_id: 1
                };
                const is = new ImportSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE)

                const errorOutput = new Error("any error");

                jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "ensureFolderExists").mockRejectedValue(errorOutput);
                jest.spyOn(mockSampleRepository, "listImportableSamples");
                jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //ensureSamplesAreBothInHeadersAndInRawData
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder");
                jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "formatSampleToImport");
                jest.spyOn(mockSampleRepository, "createManySamples");
                //jest.spyOn(mockTaskRepository, "//");
                jest.spyOn(mockTaskRepository, "finishTask");
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder");
                jest.spyOn(mockTaskRepository, "getTask");
                jest.spyOn(mockTaskRepository, "logMessage");
                //jest.spyOn(mockTaskRepository, "failedTask");

                await (is as any).startImportTask(TaskResponseModel_1, ["sample1", "sample2"], "UVP5HD", projectResponseModel, current_user.user_id)

                expect(mockTaskRepository.startTask).toBeCalledTimes(1);
                expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(1);
                expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(0);
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(1);
                expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, errorOutput);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(0);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(0);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.getTask).toBeCalledTimes(0);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(0);
            });
            test("should throw an error if no samples to import", async () => {
                const current_user: UserUpdateModel = {
                    user_id: 1
                };
                const is = new ImportSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE)

                const errorOutput = new Error("No samples to import");

                jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue([]);
                jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //ensureSamplesAreBothInHeadersAndInRawData
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder");
                jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "formatSampleToImport");
                jest.spyOn(mockSampleRepository, "createManySamples");
                //jest.spyOn(mockTaskRepository, "//");
                jest.spyOn(mockTaskRepository, "finishTask");
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder");
                jest.spyOn(mockTaskRepository, "getTask");
                jest.spyOn(mockTaskRepository, "logMessage");
                //jest.spyOn(mockTaskRepository, "failedTask");

                await (is as any).startImportTask(TaskResponseModel_1, ["sample1", "sample2"], "UVP5HD", projectResponseModel, current_user.user_id)

                expect(mockTaskRepository.startTask).toBeCalledTimes(1);
                expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(1);
                expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(1);
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(1);
                expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, errorOutput);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(0);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(0);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.getTask).toBeCalledTimes(0);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(0);
            });
            test("should throw an error if SamplesAre not BothInHeadersAndInRawData", async () => {
                const current_user: UserUpdateModel = {
                    user_id: 1
                };
                const is = new ImportSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE)

                const errorOutput = new Error("Samples not importable: sample1, sample2");

                jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue(listImportableSamplesResult);
                jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
                //ensureSamplesAreBothInHeadersAndInRawData
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder");
                jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "formatSampleToImport");
                jest.spyOn(mockSampleRepository, "createManySamples");
                //jest.spyOn(mockTaskRepository, "//");
                jest.spyOn(mockTaskRepository, "finishTask");
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder");
                jest.spyOn(mockTaskRepository, "getTask");
                jest.spyOn(mockTaskRepository, "logMessage");
                //jest.spyOn(mockTaskRepository, "failedTask");

                await (is as any).startImportTask(TaskResponseModel_1, ["sample1", "sample2"], "UVP5HD", projectResponseModel, current_user.user_id)

                expect(mockTaskRepository.startTask).toBeCalledTimes(1);
                expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(1);
                expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(1);
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(1);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(1);
                expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, errorOutput);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(0);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(0);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.getTask).toBeCalledTimes(0);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(0);
            });
            test("should throw an error if unknown instrument model", async () => {
                const current_user: UserUpdateModel = {
                    user_id: 1
                };
                const is = new ImportSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE)

                const errorOutput = new Error("Unknown instrument model");

                jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue(listImportableSamplesResult);
                jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
                //ensureSamplesAreBothInHeadersAndInRawData
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder");
                jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "formatSampleToImport");
                jest.spyOn(mockSampleRepository, "createManySamples");
                //jest.spyOn(mockTaskRepository, "//");
                jest.spyOn(mockTaskRepository, "finishTask");
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder");
                jest.spyOn(mockTaskRepository, "getTask");
                jest.spyOn(mockTaskRepository, "logMessage");
                //jest.spyOn(mockTaskRepository, "failedTask");

                await (is as any).startImportTask(TaskResponseModel_1, ["perle3_001", "Mooring_0N_23W_201910_850m"], "TUTU", projectResponseModel, current_user.user_id)

                expect(mockTaskRepository.startTask).toBeCalledTimes(1);
                expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(1);
                expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(1);
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(3);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(1);
                expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, errorOutput);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(0);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(0);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.getTask).toBeCalledTimes(0);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(0);
            });
            test("should throw an error and deleteSourcesFromProjectFolder if something went wrong during the import", async () => {
                const current_user: UserUpdateModel = {
                    user_id: 1
                };
                const is = new ImportSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE)

                const errorOutput = new Error("any error");

                jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue(listImportableSamplesResult);
                jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
                //ensureSamplesAreBothInHeadersAndInRawData
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder");
                jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder").mockResolvedValue();
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "formatSampleToImport").mockResolvedValue(sampleRequestCreationModel_1);
                jest.spyOn(mockSampleRepository, "createManySamples").mockRejectedValue(errorOutput);
                //jest.spyOn(mockTaskRepository, "//");
                jest.spyOn(mockTaskRepository, "finishTask");
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder").mockResolvedValue();
                jest.spyOn(mockTaskRepository, "getTask").mockResolvedValue(TaskResponseModel_1);
                jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
                //jest.spyOn(mockTaskRepository, "failedTask");

                await (is as any).startImportTask(TaskResponseModel_1, ["perle3_001", "Mooring_0N_23W_201910_850m"], "UVP5SD", projectResponseModel, current_user.user_id)

                expect(mockTaskRepository.startTask).toBeCalledTimes(1);
                expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(1);
                expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(1);
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(5);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(1);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(1);
                expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, errorOutput);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(2);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(1);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(1);
                expect(mockTaskRepository.getTask).toBeCalledTimes(1);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(1);
            });
        });
        describe("success senarios", () => {
            test("should copy samples to import folder for any uvp5", async () => {
                const current_user: UserUpdateModel = {
                    user_id: 1
                };
                const is = new ImportSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE)

                jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue(listImportableSamplesResult);
                jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
                //ensureSamplesAreBothInHeadersAndInRawData
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder");
                jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder").mockResolvedValue();
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockTaskRepository, "failedTask")
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "formatSampleToImport").mockResolvedValue(sampleRequestCreationModel_1);
                jest.spyOn(mockSampleRepository, "createManySamples").mockResolvedValue([1, 2]);
                //jest.spyOn(mockTaskRepository, "//");
                jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder");
                jest.spyOn(mockTaskRepository, "getTask").mockResolvedValue(TaskResponseModel_1);
                jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
                //jest.spyOn(mockTaskRepository, "failedTask");

                await (is as any).startImportTask(TaskResponseModel_1, ["perle3_001", "Mooring_0N_23W_201910_850m"], "UVP5HD", projectResponseModel, current_user.user_id)

                expect(mockTaskRepository.startTask).toBeCalledTimes(1);
                expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(1);
                expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(1);
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(6);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(1);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(2);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(1);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.getTask).toBeCalledTimes(0);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(0);
            });
            test("should copy samples to import folder for any uvp6", async () => {
                const current_user: UserUpdateModel = {
                    user_id: 1
                };
                const is = new ImportSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE)

                jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue(listImportableSamplesResult);
                jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
                //ensureSamplesAreBothInHeadersAndInRawData
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder");
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockTaskRepository, "failedTask")
                //jest.spyOn(mockTaskRepository, "updateTaskProgress");
                jest.spyOn(mockSampleRepository, "formatSampleToImport").mockResolvedValue(sampleRequestCreationModel_1);
                jest.spyOn(mockSampleRepository, "createManySamples").mockResolvedValue([1, 2]);
                //jest.spyOn(mockTaskRepository, "//");
                jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder");
                jest.spyOn(mockTaskRepository, "getTask").mockResolvedValue(TaskResponseModel_1);
                jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
                //jest.spyOn(mockTaskRepository, "failedTask");

                await (is as any).startImportTask(TaskResponseModel_1, ["perle3_001", "Mooring_0N_23W_201910_850m"], "UVP6M", projectResponseModel, current_user.user_id)

                expect(mockTaskRepository.startTask).toBeCalledTimes(1);
                expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(1);
                expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(1);
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(6);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(1);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(2);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(1);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.getTask).toBeCalledTimes(0);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(0);
            });
        });
    });
});