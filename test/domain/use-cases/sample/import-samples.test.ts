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
import { Uvp5PivotReport } from "../../../../src/domain/entities/pivot";
import { SampleSourceQcMetadata } from "../../../../src/domain/entities/sample-qc-graph";

let mockUserRepository: UserRepository;
let mockSampleRepository: SampleRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let mockProjectRepository: ProjectRepository;
let mockTaskRepository: TaskRepository;
let DATA_STORAGE_FS_STORAGE: string;
let importSamplesUseCase: ImportSamples;

const pivotReport: Uvp5PivotReport = {
    sample_name: "perle3_001",
    converter_version: "1",
    frames_written: 10,
    frames_outside_window: 2,
    empty_frames: 0,
    frames_without_pressure: 0,
    duplicate_image_ids: 0,
    integrity_mismatches: 0,
};

const sourceMetadata = (sample_type_label: string): SampleSourceQcMetadata => ({
    filter_first_image: "1",
    filter_last_image: "999",
    instrument_settings_image_volume_l: 1,
    instrument_settings_depth_offset_m: null,
    sample_type_label,
});

beforeEach(async () => {
    jest.clearAllMocks();
    mockSampleRepository = new MockSampleRepository()
    mockUserRepository = new MockUserRepository()
    mockPrivilegeRepository = new MockPrivilegeRepository()
    mockProjectRepository = new MockProjectRepository()
    mockTaskRepository = new MockTaskRepository()
    DATA_STORAGE_FS_STORAGE = "data_storage/files_system_storage/"

    importSamplesUseCase = new ImportSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE)

    // Step 1/4 reads the sample type and the max pressure of every sample from the source folder.
    jest.spyOn(mockSampleRepository, "getSourceFilterMetadata").mockResolvedValue(sourceMetadata("Depth"));
    jest.spyOn(mockSampleRepository, "getSourceMaxPressure").mockResolvedValue(150);
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
                jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
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
                expect(mockTaskRepository.logMessage).toBeCalledTimes(3);
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
                jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockResolvedValue(pivotReport);
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
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(9);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(1);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(1);
                expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, errorOutput);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(2);
                expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(2);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(1);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(1);
                expect(mockTaskRepository.getTask).toBeCalledTimes(1);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(4);
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
                jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockResolvedValue(pivotReport);
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
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(10);
                expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(2);
                expect(mockSampleRepository.generateUvp5Pivot).toBeCalledWith(projectResponseModel.project_id, sampleRequestCreationModel_1, "UVP5HD");
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(1);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(2);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(1);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.getTask).toBeCalledTimes(0);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(5);
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
                jest.spyOn(mockSampleRepository, "generateUvp5Pivot");
                jest.spyOn(mockSampleRepository, "createManySamples").mockResolvedValue([1, 2]);
                //jest.spyOn(mockTaskRepository, "//");
                jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder");
                jest.spyOn(mockTaskRepository, "getTask").mockResolvedValue(TaskResponseModel_1);
                jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
                //jest.spyOn(mockTaskRepository, "failedTask");

                await (is as any).startImportTask(TaskResponseModel_1, ["perle3_001", "Mooring_0N_23W_201910_850m"], "UVP6M", { ...projectResponseModel, instrument_model: "UVP6M" }, current_user.user_id)

                expect(mockTaskRepository.startTask).toBeCalledTimes(1);
                expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(1);
                expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(1);
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(7);
                expect(mockTaskRepository.updateTaskProgress).toBeCalledWith({ task_id: TaskResponseModel_1.task_id }, 70, "Step 3/4 pivot construction : skipped, a UVP6 particules.zip is already in the pivot format");
                expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(1);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(2);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(1);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.getTask).toBeCalledTimes(0);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(7);
            });
        });
    });

    describe("UVP5 pivot at import", () => {
        test("step 3/4 builds the pivot of every UVP5 sample, then step 4/4 creates the samples", async () => {
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue(listImportableSamplesResult);
            const progress = jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "formatSampleToImport").mockResolvedValue(sampleRequestCreationModel_1);
            const generate = jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockResolvedValue(pivotReport);
            const create = jest.spyOn(mockSampleRepository, "createManySamples").mockResolvedValue([101, 202]);
            jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();

            await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, ["perle3_001", "Mooring_0N_23W_201910_850m"], "UVP5HD", projectResponseModel, { user_id: 1 });

            const report_line = "perle3_001: 10 frames written, 2 outside [firstimage, endimg], 0 without particle, 0 .bru frames without pressure, 0 duplicate image ids, 0 integrity mismatches";
            expect(progress.mock.calls.map(([, pct, msg]) => [pct, msg])).toEqual([
                [10, "Step 1/4 sample validation : start"],
                [20, "Step 1/4 sample validation : done"],
                [25, "Step 2/4 sample folders copy : start"],
                [50, "Step 2/4 sample folders copy : done"],
                [55, "Step 3/4 pivot construction : start"],
                [63, "Step 3/4 pivot construction : " + report_line],
                [70, "Step 3/4 pivot construction : " + report_line],
                [70, "Step 3/4 pivot construction : done"],
                [75, "Step 4/4 samples db creation : start"],
                [100, "Step 4/4 samples db creation done"],
            ]);
            expect(generate).toBeCalledTimes(2);
            expect(generate.mock.invocationCallOrder[1]).toBeLessThan(create.mock.invocationCallOrder[0]);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
        });

        test("fails the import with the explicit pivot error, deletes the copied sources and creates no sample", async () => {
            const pivotError = new Error("Cannot build the UVP5 pivot of sample perle3_001: no frame of perle3_001_datfile.txt lies inside [firstimage, endimg] = [500, 600]. Correct firstimage / endimg of the sample in the meta header, then relaunch the import or the pivot regeneration.");
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue(listImportableSamplesResult);
            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "formatSampleToImport").mockResolvedValue(sampleRequestCreationModel_1);
            jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockRejectedValue(pivotError);
            jest.spyOn(mockSampleRepository, "createManySamples");
            jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "getTask").mockResolvedValue(TaskResponseModel_1);
            jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "finishTask");

            await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, ["perle3_001", "Mooring_0N_23W_201910_850m"], "UVP5HD", projectResponseModel, { user_id: 1 });

            expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(1);
            expect(mockSampleRepository.createManySamples).toBeCalledTimes(0);
            expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(1);
            expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, pivotError);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
        });
    });

    describe("task log", () => {
        const loggedMessages = () => (mockTaskRepository.logMessage as jest.Mock).mock.calls.map(([, message]) => message);

        beforeEach(() => {
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue(listImportableSamplesResult);
            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "formatSampleToImport").mockResolvedValue(sampleRequestCreationModel_1);
            jest.spyOn(mockSampleRepository, "createManySamples").mockResolvedValue([101, 202]);
            jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
        });

        test("logs every step of a UVP5 import in the task log file, the copy details with the step 2/4 prefix", async () => {
            jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder").mockImplementation(async (_source, _dest, _samples, log) => {
                await log("perle3_001 (1/2) : work source work/perle3_001.zip (1.0 KB)");
            });
            jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockResolvedValue(pivotReport);

            await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, ["perle3_001", "Mooring_0N_23W_201910_850m"], "UVP5HD", projectResponseModel, { user_id: 1 });

            expect(mockTaskRepository.logMessage).toBeCalledWith(TaskResponseModel_1.task_log_file_path, expect.any(String));
            expect(loggedMessages()).toEqual([
                "Step 1/4 sample validation : 2 sample(s) to import out of 2 importable",
                "Step 1/4 sample validation : perle3_001 : raw file 20200313004656, images [2790, 15872], 0 vignettes",
                "Step 1/4 sample validation : Mooring_0N_23W_201910_850m : raw file 20191012-000000_Merged-020, images [3432, 107843], 0 vignettes",
                "Step 2/4 sample folders copy : perle3_001 (1/2) : work source work/perle3_001.zip (1.0 KB)",
                "Step 4/4 samples db creation : perle3_001 created (sample_id 101)",
                "Step 4/4 samples db creation : Mooring_0N_23W_201910_850m created (sample_id 202)",
            ]);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
        });

        test("logs a warning when the UVP6 black frames cannot be counted, and still imports the sample", async () => {
            const uvp6_project = { ...projectResponseModel, instrument_model: "UVP6M" };
            jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "countBlackParticulesUvp6")
                .mockResolvedValueOnce(12)
                .mockRejectedValueOnce(new Error("particules.csv not found"));

            await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, ["perle3_001", "Mooring_0N_23W_201910_850m"], "UVP6M", uvp6_project, { user_id: 1 });

            expect(loggedMessages()).toContain("Step 3/4 pivot construction : Mooring_0N_23W_201910_850m : WARNING black frames not counted, nb_black set to 0 (particules.csv not found)");
            expect(loggedMessages().filter((message: string) => message.includes("WARNING"))).toHaveLength(1);
            expect(mockSampleRepository.createManySamples).toBeCalledTimes(1);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
        });
    });

    describe("samples without pressure", () => {
        beforeEach(() => {
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue(listImportableSamplesResult);
            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "formatSampleToImport").mockResolvedValue({ ...sampleRequestCreationModel_1, max_pressure: null });
            jest.spyOn(mockSampleRepository, "countBlackParticulesUvp6").mockResolvedValue(0);
            jest.spyOn(mockSampleRepository, "createManySamples").mockResolvedValue([101, 202]);
            jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
        });
        const uvp6_project = { ...projectResponseModel, instrument_model: "UVP6M" };
        const samples = ["perle3_001", "Mooring_0N_23W_201910_850m"];

        test("refuses at step 1/4 a depth profile whose particle file has no readable pressure, before any copy", async () => {
            jest.spyOn(mockSampleRepository, "getSourceMaxPressure").mockResolvedValueOnce(150).mockResolvedValueOnce(null);

            await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, samples, "UVP6M", uvp6_project, { user_id: 1 });

            expect(mockSampleRepository.getSourceFilterMetadata).toBeCalledWith(uvp6_project.root_folder_path, "Mooring_0N_23W_201910_850m", "UVP6M");
            expect(mockSampleRepository.getSourceMaxPressure).toBeCalledWith(uvp6_project.root_folder_path, "Mooring_0N_23W_201910_850m", "UVP6M");
            expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, new Error("Depth profiles without any readable pressure: Mooring_0N_23W_201910_850m. Check the pressure column of their particle file (UVP6 particules.csv, UVP5 datfile), or declare them as time series."));
            expect(mockTaskRepository.updateTaskProgress).not.toBeCalledWith({ task_id: TaskResponseModel_1.task_id }, 20, "Step 1/4 sample validation : done");
            expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
            expect(mockSampleRepository.createManySamples).toBeCalledTimes(0);
        });

        test("imports a time series without pressure, with a NULL max_pressure, without reading its pressure at step 1/4", async () => {
            jest.spyOn(mockSampleRepository, "getSourceFilterMetadata").mockResolvedValue(sourceMetadata("Time"));

            await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, samples, "UVP6M", uvp6_project, { user_id: 1 });

            expect(mockSampleRepository.getSourceFilterMetadata).toBeCalledTimes(2);
            expect(mockSampleRepository.getSourceMaxPressure).toBeCalledTimes(0);
            expect(mockSampleRepository.createManySamples).toBeCalledWith([
                expect.objectContaining({ max_pressure: null }),
                expect.objectContaining({ max_pressure: null }),
            ]);
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
        });
    });

    describe("validate at import", () => {
        test("rejects validated_samples that are not part of the imported set (before any task is created)", async () => {
            const current_user: UserUpdateModel = { user_id: 1 };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true);
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(true);
            const createTask = jest.spyOn(mockTaskRepository, "createTask");
            const getProject = jest.spyOn(mockProjectRepository, "getProject");

            await expect(
                importSamplesUseCase.execute(current_user, 1, ["sample1"], ["sample1", "sampleX"])
            ).rejects.toThrow("Invalid validated_samples: sampleX");

            // Fails fast — no project lookup, no task created.
            expect(getProject).toBeCalledTimes(0);
            expect(createTask).toBeCalledTimes(0);
        });

        test("flips only the validated samples to VALIDATED after creation, with the audit fields", async () => {
            const is = new ImportSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE);
            const log = jest.fn().mockResolvedValue(undefined);

            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
            // createManySamples returns ids in the same order as the input names.
            jest.spyOn(mockSampleRepository, "createManySamples").mockResolvedValue([101, 202]);
            const getStatus = jest.spyOn(mockSampleRepository, "getVisualQCStatus").mockResolvedValue({ visual_qc_status_id: 2, visual_qc_status_label: "VALIDATED" });
            const setQc = jest.spyOn(mockSampleRepository, "setSampleVisualQc").mockResolvedValue(1);

            await (is as any).importSamples(
                TaskResponseModel_1.task_id,
                log,
                projectResponseModel,
                7,
                ["perle3_001", "Mooring_0N_23W_201910_850m"],
                [sampleRequestCreationModel_1, sampleRequestCreationModel_1],
                ["Mooring_0N_23W_201910_850m"]
            );

            expect(getStatus).toBeCalledWith({ visual_qc_status_label: "VALIDATED" });
            expect(setQc).toBeCalledTimes(1);
            expect(setQc).toBeCalledWith(202, 2, 7, "Validated at import (pre-import visual QC)", expect.any(String));
            expect(log.mock.calls.map(([message]) => message)).toEqual([
                "Step 4/4 samples db creation : perle3_001 created (sample_id 101)",
                "Step 4/4 samples db creation : Mooring_0N_23W_201910_850m created (sample_id 202)",
                "Step 4/4 samples db creation : Mooring_0N_23W_201910_850m (sample_id 202) visual QC set to VALIDATED (pre-import visual QC)",
            ]);
        });

        test("does not touch visual QC when no samples are validated", async () => {
            const is = new ImportSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE);
            const log = jest.fn().mockResolvedValue(undefined);

            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "createManySamples").mockResolvedValue([101, 202]);
            const getStatus = jest.spyOn(mockSampleRepository, "getVisualQCStatus");
            const setQc = jest.spyOn(mockSampleRepository, "setSampleVisualQc");

            await (is as any).importSamples(
                TaskResponseModel_1.task_id,
                log,
                projectResponseModel,
                7,
                ["perle3_001", "Mooring_0N_23W_201910_850m"],
                [sampleRequestCreationModel_1, sampleRequestCreationModel_1],
                []
            );

            expect(getStatus).toBeCalledTimes(0);
            expect(setQc).toBeCalledTimes(0);
        });
    });
});