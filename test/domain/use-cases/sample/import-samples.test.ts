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
import { TaskResponseModel_1, toPublicTask } from "../../../entities/task";
import { TASK_CANCELLED_MESSAGE } from "../../../../src/domain/constants/task";
import { listImportableSamplesResult, sampleRequestCreationModel_1 } from "../../../entities/sample";
import { Uvp5PivotReport } from "../../../../src/domain/entities/pivot";
import { SampleSourceQcMetadata } from "../../../../src/domain/entities/sample-qc-graph";
import { PivotImageRecord } from "../../../../src/domain/entities/binned-export";
import { PivotImages } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { toPerImageColumns } from "../../../../src/domain/utils/per-image-columns";

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

// A pivot read in two passes from records already in memory.
function pivotOf(records: PivotImageRecord[]): PivotImages {
    return { columns: toPerImageColumns(records), rows: async function* () { yield* records; } };
}

// One lit image per [raw_pressure, area_px, nb_particles].
function pivotLines(lines: Array<[number, number, number]>): PivotImages {
    return pivotOf(lines.map(([raw_pressure, area_px, nb_particles], i) => ({
        image_index: i, image_id: `img${i}`, raw_pressure, image_time_ms: Date.UTC(2020, 7, 6, 22, 0, i), light_on: true,
        spectrum_counts: { [area_px]: nb_particles }, blocks: [{ area_px, nb_particles, grey_mean: 10 }],
    })));
}

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
    // Defaults: a task that is never cancelled, returned without its log file path
    jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValue();
    jest.spyOn(mockTaskRepository, "toPublicTask").mockImplementation(toPublicTask);

    // Step 1/4 reads the sample type and the max pressure of every sample from the source folder.
    jest.spyOn(mockSampleRepository, "getSourceFilterMetadata").mockResolvedValue(sourceMetadata("Depth"));
    jest.spyOn(mockSampleRepository, "getSourceMaxPressure").mockResolvedValue(150);
    // and looks for the work files of every UVP5 sample there.
    jest.spyOn(mockSampleRepository, "checkUvp5WorkFiles").mockImplementation(async (_root_folder_path, sample_name) => ({ work_source: `work/${sample_name}.tar.zst`, files_count: 3, missing: [] }));

    // Step 3/4 reads the particle statistics of every sample from its pivot (an empty one by default).
    jest.spyOn(mockSampleRepository, "getSampleType").mockResolvedValue({ sample_type_id: 1, sample_type_label: "Depth", sample_type_description: "Depth profile" });
    jest.spyOn(mockSampleRepository, "getPivotImages").mockImplementation(async () => pivotOf([]));
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
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder").mockImplementation(() => Promise.resolve([]));
                jest.spyOn(mockTaskRepository, "getTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1));
                jest.spyOn(mockTaskRepository, "logMessage").mockImplementation(() => Promise.resolve());
                //jest.spyOn(mockTaskRepository, "failedTask");

                await expect(importSamplesUseCase.execute(current_user, 1, ["sample1", "sample2"])).resolves.toEqual(toPublicTask(TaskResponseModel_1));

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
            test("should explain every requested sample when none is importable", async () => {
                const current_user: UserUpdateModel = {
                    user_id: 1
                };
                const is = new ImportSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE)

                const errorOutput = new Error("Samples not importable: sample1 (already imported in this project), sample2 (a folder with this name already exists in the project storage but the sample is not in the database)");

                jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue([]);
                jest.spyOn(mockSampleRepository, "explainNotImportableSamples").mockResolvedValue(new Map([
                    ["sample1", "already imported in this project"],
                    ["sample2", "a folder with this name already exists in the project storage but the sample is not in the database"],
                ]));
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
                expect(mockSampleRepository.explainNotImportableSamples).toBeCalledWith(projectResponseModel.root_folder_path, "data_storage/files_system_storage/1", projectResponseModel.project_id, ["sample1", "sample2"]);
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
            test("should throw an error if SamplesAre not BothInHeadersAndInRawData", async () => {
                const current_user: UserUpdateModel = {
                    user_id: 1
                };
                const is = new ImportSamples(mockSampleRepository, mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockTaskRepository, DATA_STORAGE_FS_STORAGE)

                const errorOutput = new Error("Samples not importable: sample1 (already imported in this project), sample2 (not listed in the meta header file)");

                jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue(listImportableSamplesResult);
                jest.spyOn(mockSampleRepository, "explainNotImportableSamples").mockResolvedValue(new Map([
                    ["sample1", "already imported in this project"],
                    ["sample2", "not listed in the meta header file"],
                ]));
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
                // Only the vignettes of the samples to import are counted.
                expect(mockSampleRepository.listImportableSamples).toBeCalledWith(projectResponseModel.root_folder_path, projectResponseModel.instrument_model, "data_storage/files_system_storage/1", projectResponseModel.project_id, ["sample1", "sample2"]);
                expect(mockSampleRepository.explainNotImportableSamples).toBeCalledWith(projectResponseModel.root_folder_path, "data_storage/files_system_storage/1", projectResponseModel.project_id, ["sample1", "sample2"]);
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
                expect(mockTaskRepository.logMessage).toBeCalledTimes(5);
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
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder").mockResolvedValue([]);
                jest.spyOn(mockTaskRepository, "getTask").mockResolvedValue(TaskResponseModel_1);
                jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
                //jest.spyOn(mockTaskRepository, "failedTask");

                await (is as any).startImportTask(TaskResponseModel_1, ["perle3_001", "Mooring_0N_23W_201910_850m"], "UVP5SD", projectResponseModel, current_user.user_id)

                expect(mockTaskRepository.startTask).toBeCalledTimes(1);
                expect(mockSampleRepository.ensureFolderExists).toBeCalledTimes(1);
                expect(mockSampleRepository.listImportableSamples).toBeCalledTimes(1);
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(11);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(1);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(1);
                expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, errorOutput);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(2);
                expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(2);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(1);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(1);
                expect(mockTaskRepository.getTask).toBeCalledTimes(0);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(7);
            });
        });
        describe("cancellation", () => {
            const arrangeUvp5Import = () => {
                jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue(listImportableSamplesResult);
                jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "formatSampleToImport").mockResolvedValue(sampleRequestCreationModel_1);
                jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockResolvedValue(pivotReport);
                jest.spyOn(mockSampleRepository, "createManySamples");
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder").mockResolvedValue([]);
                jest.spyOn(mockTaskRepository, "getTask").mockResolvedValue(TaskResponseModel_1);
                jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
                jest.spyOn(mockTaskRepository, "finishTask");
                jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
            }
            const cancelled = new Error(TASK_CANCELLED_MESSAGE);

            test("cancelled during the validation : nothing is copied, nothing to clean", async () => {
                arrangeUvp5Import();
                jest.spyOn(mockTaskRepository, "throwIfCancelled").mockRejectedValue(cancelled);

                await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, ["perle3_001", "Mooring_0N_23W_201910_850m"], "UVP5SD", projectResponseModel, { user_id: 1 })

                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
                expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, cancelled);
            });

            test("cancelled during the pivot construction : the copied sources are removed and no sample is created", async () => {
                arrangeUvp5Import();
                // before the work files check of each sample, before the copy, after the copy, then before the first pivot
                jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValueOnce().mockResolvedValueOnce().mockResolvedValueOnce().mockResolvedValueOnce().mockRejectedValue(cancelled);

                await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, ["perle3_001", "Mooring_0N_23W_201910_850m"], "UVP5SD", projectResponseModel, { user_id: 1 })

                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(1);
                expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(0);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(0);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledWith(expect.any(String), ["perle3_001", "Mooring_0N_23W_201910_850m"]);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
                expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, cancelled);
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
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(12);
                expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(2);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledWith(expect.objectContaining({ sample_name: "perle3_001" }), "UVP5HD", projectResponseModel.root_folder_path);
                expect(mockSampleRepository.generateUvp5Pivot).toBeCalledWith(projectResponseModel.project_id, sampleRequestCreationModel_1, "UVP5HD", projectResponseModel.root_folder_path);
                expect(mockSampleRepository.UVP6copySamplesToImportFolder).toBeCalledTimes(0);
                expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(1);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
                expect(mockSampleRepository.formatSampleToImport).toBeCalledTimes(2);
                expect(mockSampleRepository.createManySamples).toBeCalledTimes(1);
                expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
                expect(mockTaskRepository.getTask).toBeCalledTimes(0);
                expect(mockTaskRepository.logMessage).toBeCalledTimes(7);
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
                expect(mockTaskRepository.updateTaskProgress).toBeCalledTimes(9);
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
            const read_pivot = jest.spyOn(mockSampleRepository, "getPivotImages").mockImplementation(async () => pivotLines([[10, 3, 5], [20, 80, 1]]));
            const create = jest.spyOn(mockSampleRepository, "createManySamples").mockResolvedValue([101, 202]);
            jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();

            await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, ["perle3_001", "Mooring_0N_23W_201910_850m"], "UVP5HD", projectResponseModel, { user_id: 1 });

            const report_line = "perle3_001: 10 frames written, 2 outside [firstimage, endimg], 0 without particle, 0 .bru frames without pressure, 0 duplicate image ids, 0 integrity mismatches";
            const stats_line = "Step 3/4 particle statistics : Mooring_0N_23W_201910_850m: 6 particle(s) counted, areas from 3 to 80 px";
            expect(progress.mock.calls.map(([, pct, msg]) => [pct, msg])).toEqual([
                [10, "Step 1/4 sample validation : start"],
                [20, "Step 1/4 sample validation : done"],
                [25, "Step 2/4 sample folders copy : start"],
                [50, "Step 2/4 sample folders copy : done"],
                [55, "Step 3/4 pivot construction : start"],
                [63, "Step 3/4 pivot construction : " + report_line],
                [70, "Step 3/4 pivot construction : " + report_line],
                [70, "Step 3/4 pivot construction : done"],
                [72, stats_line],
                [74, stats_line],
                [75, "Step 4/4 samples db creation : start"],
                [100, "Step 4/4 samples db creation done"],
            ]);
            expect(generate).toBeCalledTimes(2);
            expect(generate.mock.invocationCallOrder[1]).toBeLessThan(read_pivot.mock.invocationCallOrder[0]);
            expect(read_pivot.mock.invocationCallOrder[1]).toBeLessThan(create.mock.invocationCallOrder[0]);
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
            jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder").mockResolvedValue([]);
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
                "Step 1/4 sample validation : perle3_001 : work files found in work/perle3_001.tar.zst (3 files)",
                "Step 1/4 sample validation : Mooring_0N_23W_201910_850m : work files found in work/Mooring_0N_23W_201910_850m.tar.zst (3 files)",
                "Step 1/4 sample validation : perle3_001 : raw file 20200313004656, images [2790, 15872], 0 vignettes",
                "Step 1/4 sample validation : Mooring_0N_23W_201910_850m : raw file 20191012-000000_Merged-020, images [3432, 107843], 0 vignettes",
                "Step 2/4 sample folders copy : perle3_001 (1/2) : work source work/perle3_001.zip (1.0 KB)",
                "Step 4/4 samples db creation : perle3_001 created (sample_id 101)",
                "Step 4/4 samples db creation : Mooring_0N_23W_201910_850m created (sample_id 202)",
            ]);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
        });

        describe("cleanup of the copied sources", () => {
            const samples = ["perle3_001", "Mooring_0N_23W_201910_850m"];
            const dest_folder = "data_storage/files_system_storage/1";
            beforeEach(() => {
                jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder").mockResolvedValue();
                jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockResolvedValue(pivotReport);
            });

            test("after a failure : logs the samples whose copies are removed, then every removed path", async () => {
                jest.spyOn(mockSampleRepository, "createManySamples").mockRejectedValue(new Error("SQLITE_BUSY"));
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder").mockResolvedValue([
                    `${dest_folder}/perle3_001/ (2 files, 1.0 KB)`,
                    `${dest_folder}/Mooring_0N_23W_201910_850m/ (2 files, 2.0 KB)`,
                ]);

                await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, samples, "UVP5HD", projectResponseModel, { user_id: 1 });

                expect(loggedMessages().slice(-2)).toEqual([
                    `Cleanup after failure : removing the copies of 2 sample(s) from ${dest_folder} : perle3_001, Mooring_0N_23W_201910_850m`,
                    `Cleanup after failure : removed ${dest_folder}/perle3_001/ (2 files, 1.0 KB), ${dest_folder}/Mooring_0N_23W_201910_850m/ (2 files, 2.0 KB)`,
                ]);
                expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, new Error("SQLITE_BUSY"));
            });

            test("after a cancellation : the cleanup lines say so, and an absent copy is reported", async () => {
                jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValueOnce().mockResolvedValueOnce().mockResolvedValueOnce().mockResolvedValueOnce().mockRejectedValue(new Error(TASK_CANCELLED_MESSAGE));
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder").mockResolvedValue([]);

                await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, samples, "UVP5HD", projectResponseModel, { user_id: 1 });

                expect(loggedMessages().slice(-2)).toEqual([
                    `Cleanup after cancellation : removing the copies of 2 sample(s) from ${dest_folder} : perle3_001, Mooring_0N_23W_201910_850m`,
                    "Cleanup after cancellation : nothing removed, no copy found",
                ]);
            });

            test("a failing removal is logged and the task still fails with its own error", async () => {
                const importError = new Error("SQLITE_BUSY");
                jest.spyOn(mockSampleRepository, "createManySamples").mockRejectedValue(importError);
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder").mockRejectedValue(new Error("EACCES: permission denied"));

                await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, samples, "UVP5HD", projectResponseModel, { user_id: 1 });

                expect(loggedMessages()).toContain(`Cleanup after failure : removal failed, copies may remain in ${dest_folder} : EACCES: permission denied`);
                expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, importError);
            });

            test("a log file that cannot be written does not stop the cleanup nor the final status", async () => {
                jest.spyOn(mockSampleRepository, "createManySamples").mockRejectedValue(new Error("SQLITE_BUSY"));
                jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder").mockResolvedValue([]);
                jest.spyOn(mockTaskRepository, "logMessage").mockImplementation((async (_path: string, message: string) => {
                    if (message.startsWith("Cleanup")) throw new Error("ENOSPC");
                }) as any);

                await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, samples, "UVP5HD", projectResponseModel, { user_id: 1 });

                expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(1);
                expect(mockTaskRepository.failedTask).toBeCalledTimes(1);
            });
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

    describe("files read after the copy, checked at step 1/4", () => {
        const loggedMessages = () => (mockTaskRepository.logMessage as jest.Mock).mock.calls.map(([, message]) => message);
        const samples = ["perle3_001", "Mooring_0N_23W_201910_850m"];

        beforeEach(() => {
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue(listImportableSamplesResult);
            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "UVP5copySamplesToImportFolder").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "formatSampleToImport").mockResolvedValue(sampleRequestCreationModel_1);
            jest.spyOn(mockSampleRepository, "countBlackParticulesUvp6").mockResolvedValue(0);
            jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockResolvedValue(pivotReport);
            jest.spyOn(mockSampleRepository, "createManySamples").mockResolvedValue([101, 202]);
            jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder").mockResolvedValue([]);
            jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
        });

        test("refuses before any copy every UVP5 sample whose work entry lacks a file, all in one error", async () => {
            jest.spyOn(mockSampleRepository, "checkUvp5WorkFiles")
                .mockResolvedValueOnce({ work_source: "work/perle3_001.tar.zst", files_count: 2931, missing: ["HDR*.txt"] })
                .mockRejectedValueOnce(new Error("end of central directory record signature not found"));

            await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, samples, "UVP5HD", projectResponseModel, { user_id: 1 });

            expect(mockSampleRepository.checkUvp5WorkFiles).toBeCalledTimes(2);
            expect(mockSampleRepository.checkUvp5WorkFiles).toBeCalledWith(projectResponseModel.root_folder_path, "Mooring_0N_23W_201910_850m");
            expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, new Error(
                "Samples with missing work files: perle3_001 (work/perle3_001.tar.zst (2931 files) has no HDR*.txt), "
                + "Mooring_0N_23W_201910_850m (its work entry cannot be read: end of central directory record signature not found). "
                + "Only the work entry of each sample is read: add the files there, then relaunch the import."));
            expect(loggedMessages()).toEqual([
                "Step 1/4 sample validation : 2 sample(s) to import out of 2 importable",
                "Step 1/4 sample validation : perle3_001 : work/perle3_001.tar.zst (2931 files) has no HDR*.txt",
                "Step 1/4 sample validation : Mooring_0N_23W_201910_850m : its work entry cannot be read: end of central directory record signature not found",
            ]);
            expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(0);
            expect(mockSampleRepository.createManySamples).toBeCalledTimes(0);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
        });

        test("does not look for work files in a UVP6 project", async () => {
            const uvp6_project = { ...projectResponseModel, instrument_model: "UVP6M" };

            await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, samples, "UVP6M", uvp6_project, { user_id: 1 });

            expect(mockSampleRepository.checkUvp5WorkFiles).toBeCalledTimes(0);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
        });

        test("a sample failing QC level 1 is refused with its reason, before the work files are looked for", async () => {
            jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue(listImportableSamplesResult.map(sample => ({
                ...sample, qc_lvl1: false, qc_lvl1_comment: "no op_email in config/cruise_info.txt",
            })));

            await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, samples, "UVP5HD", projectResponseModel, { user_id: 1 });

            expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, new Error(
                "Samples failed QC level 1 (source data missing): perle3_001 (no op_email in config/cruise_info.txt), Mooring_0N_23W_201910_850m (no op_email in config/cruise_info.txt)"));
            expect(mockSampleRepository.checkUvp5WorkFiles).toBeCalledTimes(0);
            expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(0);
        });

        test("a cancellation stops the check between two samples", async () => {
            jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValueOnce().mockRejectedValue(new Error(TASK_CANCELLED_MESSAGE));

            await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, samples, "UVP5HD", projectResponseModel, { user_id: 1 });

            expect(mockSampleRepository.checkUvp5WorkFiles).toBeCalledTimes(1);
            expect(mockSampleRepository.UVP5copySamplesToImportFolder).toBeCalledTimes(0);
            expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
            expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, new Error(TASK_CANCELLED_MESSAGE));
        });
    });

    describe("validate at import", () => {
        test("rejects an empty sample list before any task is created", async () => {
            const current_user: UserUpdateModel = { user_id: 1 };

            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true);
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(true);
            const createTask = jest.spyOn(mockTaskRepository, "createTask");
            const getProject = jest.spyOn(mockProjectRepository, "getProject");

            await expect(importSamplesUseCase.execute(current_user, 1, [])).rejects.toThrow("No samples to import");

            expect(getProject).toBeCalledTimes(0);
            expect(createTask).toBeCalledTimes(0);
        });

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
describe("particle statistics at import", () => {
    const uvp6_project = { ...projectResponseModel, instrument_model: "UVP6M", enable_descent_filter: true };
    const samples = ["perle3_001", "Mooring_0N_23W_201910_850m"];
    const loggedMessages = () => (mockTaskRepository.logMessage as jest.Mock).mock.calls.map(([, message]) => message);
    // The third image goes back up: the descent filter drops it on a depth profile.
    const yoyo = () => pivotLines([[1, 2, 3], [10, 5, 1], [6, 40, 7], [12, 9, 2]]);

    beforeEach(() => {
        jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
        jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
        jest.spyOn(mockSampleRepository, "listImportableSamples").mockResolvedValue(listImportableSamplesResult);
        jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
        jest.spyOn(mockSampleRepository, "UVP6copySamplesToImportFolder").mockResolvedValue();
        jest.spyOn(mockSampleRepository, "countBlackParticulesUvp6").mockResolvedValue(0);
        // One sample of each type: perle3_001 a depth profile (type 1), the mooring a time series (type 2).
        jest.spyOn(mockSampleRepository, "formatSampleToImport").mockImplementation(async (base) =>
            ({ ...sampleRequestCreationModel_1, sample_name: base.sample_name as string, sample_type_id: base.sample_name === "perle3_001" ? 1 : 2 }));
        jest.spyOn(mockSampleRepository, "getSampleType").mockImplementation(async ({ sample_type_id }) =>
            ({ sample_type_id: sample_type_id as number, sample_type_label: sample_type_id === 1 ? "Depth" : "Time", sample_type_description: "" }));
        jest.spyOn(mockSampleRepository, "createManySamples").mockResolvedValue([101, 202]);
        jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder").mockResolvedValue([]);
        jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue();
        jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
        jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
    });

    test("reads each sample's pivot and creates the samples with their statistics, without and with the descent filter", async () => {
        jest.spyOn(mockSampleRepository, "getPivotImages").mockImplementation(async () => yoyo());

        await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, samples, "UVP6M", uvp6_project, { user_id: 1 });

        expect(mockSampleRepository.getPivotImages).toBeCalledTimes(2);
        expect(mockSampleRepository.getPivotImages).toBeCalledWith(uvp6_project.project_id, "perle3_001", "UVP6M");
        expect(mockSampleRepository.getPivotImages).toBeCalledWith(uvp6_project.project_id, "Mooring_0N_23W_201910_850m", "UVP6M");
        expect(mockSampleRepository.getSampleType).toBeCalledWith({ sample_type_id: 1 });
        expect(mockSampleRepository.getSampleType).toBeCalledWith({ sample_type_id: 2 });
        // The descent filter drops the image that goes back up, on the depth profile only.
        expect(mockSampleRepository.createManySamples).toBeCalledWith([
            expect.objectContaining({
                sample_name: "perle3_001", nb_particles: 13, particle_min_area_px: 2, particle_max_area_px: 40,
                nb_particles_descent_filter: 6, particle_min_area_px_descent_filter: 2, particle_max_area_px_descent_filter: 9,
            }),
            expect.objectContaining({
                sample_name: "Mooring_0N_23W_201910_850m", nb_particles: 13, particle_min_area_px: 2, particle_max_area_px: 40,
                nb_particles_descent_filter: 13, particle_min_area_px_descent_filter: 2, particle_max_area_px_descent_filter: 40,
            }),
        ]);
        expect(mockTaskRepository.updateTaskProgress).toBeCalledWith({ task_id: TaskResponseModel_1.task_id }, 72, "Step 3/4 particle statistics : perle3_001: 13 particle(s) counted, areas from 2 to 40 px, 6 kept by the descent filter");
        expect(mockTaskRepository.updateTaskProgress).toBeCalledWith({ task_id: TaskResponseModel_1.task_id }, 74, "Step 3/4 particle statistics : Mooring_0N_23W_201910_850m: 13 particle(s) counted, areas from 2 to 40 px");
        expect(loggedMessages().filter((message: string) => message.includes("WARNING"))).toHaveLength(0);
        expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
    });

    test("a pivot that cannot be read leaves the statistics empty with a warning, the import goes on", async () => {
        jest.spyOn(mockSampleRepository, "getPivotImages")
            .mockRejectedValueOnce(new Error("Cannot read the particle file of sample perle3_001 (no such file)"))
            .mockImplementationOnce(async () => yoyo());

        await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, samples, "UVP6M", uvp6_project, { user_id: 1 });

        expect(loggedMessages()).toContain("Step 3/4 particle statistics : perle3_001 : WARNING particle statistics not computed, left empty (Cannot read the particle file of sample perle3_001 (no such file))");
        expect(mockSampleRepository.createManySamples).toBeCalledWith([
            expect.objectContaining({
                sample_name: "perle3_001", nb_particles: null, particle_min_area_px: null, particle_max_area_px: null,
                nb_particles_descent_filter: null, particle_min_area_px_descent_filter: null, particle_max_area_px_descent_filter: null,
            }),
            expect.objectContaining({ sample_name: "Mooring_0N_23W_201910_850m", nb_particles: 13 }),
        ]);
        expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
        expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
        expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
    });

    test("an unknown sample type is a warning too, the pivot is not read", async () => {
        jest.spyOn(mockSampleRepository, "getSampleType").mockResolvedValue(null);

        await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, samples, "UVP6M", uvp6_project, { user_id: 1 });

        expect(loggedMessages().filter((message: string) => message.includes("WARNING particle statistics not computed, left empty (Sample type not found)"))).toHaveLength(2);
        expect(mockSampleRepository.getPivotImages).toBeCalledTimes(0);
        expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
    });

    test("a cancellation during the statistics removes the copied sources and creates no sample", async () => {
        const cancelled = new Error(TASK_CANCELLED_MESSAGE);
        // before the copy, after the copy, before the first statistics, then before the second
        jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValueOnce().mockResolvedValueOnce().mockResolvedValueOnce().mockRejectedValue(cancelled);

        await (importSamplesUseCase as any).startImportTask(TaskResponseModel_1, samples, "UVP6M", uvp6_project, { user_id: 1 });

        expect(mockSampleRepository.getPivotImages).toBeCalledTimes(1);
        expect(mockSampleRepository.createManySamples).toBeCalledTimes(0);
        expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledWith(expect.any(String), samples);
        expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, cancelled);
    });
});
