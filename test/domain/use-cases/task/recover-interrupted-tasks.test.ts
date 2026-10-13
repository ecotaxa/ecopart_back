import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { TaskResponseModel_1 } from "../../../entities/task";
import { RecoverInterruptedTasks, TASK_INTERRUPTED_MESSAGE } from "../../../../src/domain/use-cases/task/recover-interrupted-tasks";
import { TASK_CANCELLED_MESSAGE } from "../../../../src/domain/constants/task";
import { PublicSampleModel } from "../../../../src/domain/entities/sample";

let mockTaskRepository: TaskRepository;
let mockProjectRepository: ProjectRepository;
let mockSampleRepository: SampleRepository;
let recoverInterruptedTasks: RecoverInterruptedTasks;

const DATA_STORAGE_FS_STORAGE = "data_storage/files_system_storage/";

beforeEach(() => {
    jest.clearAllMocks();
    mockTaskRepository = new MockTaskRepository()
    mockProjectRepository = new MockProjectRepository()
    mockSampleRepository = new MockSampleRepository()
    recoverInterruptedTasks = new RecoverInterruptedTasks(mockTaskRepository, mockProjectRepository, mockSampleRepository, DATA_STORAGE_FS_STORAGE)

    // Defaults: nothing left behind
    jest.spyOn(mockTaskRepository, "removeTaskWorkFiles").mockResolvedValue([])
    jest.spyOn(mockProjectRepository, "removeInterruptedWriteLeftovers").mockResolvedValue([])
    jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue()
})

describe("Recover Interrupted Tasks Use Case", () => {
    describe("final status", () => {
        test("nothing active : nothing to do", async () => {
            jest.spyOn(mockTaskRepository, "getActiveTasks").mockResolvedValue([])
            jest.spyOn(mockTaskRepository, "failedTask")

            await expect(recoverInterruptedTasks.execute()).resolves.toBe(0);

            expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
            expect(mockTaskRepository.removeTaskWorkFiles).toBeCalledTimes(0);
        });

        test("pending and running tasks fail, a cancelling task ends cancelled", async () => {
            jest.spyOn(mockTaskRepository, "getActiveTasks").mockResolvedValue([
                { ...TaskResponseModel_1, task_id: 1, task_status: "PENDING" },
                { ...TaskResponseModel_1, task_id: 2, task_status: "RUNNING" },
                { ...TaskResponseModel_1, task_id: 3, task_status: "CANCELLING" },
            ])
            jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue()
            jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue({} as PublicSampleModel)

            await expect(recoverInterruptedTasks.execute()).resolves.toBe(3);

            expect(mockTaskRepository.failedTask).toBeCalledWith(1, new Error(TASK_INTERRUPTED_MESSAGE));
            expect(mockTaskRepository.failedTask).toBeCalledWith(2, new Error(TASK_INTERRUPTED_MESSAGE));
            expect(mockTaskRepository.failedTask).toBeCalledWith(3, new Error(TASK_CANCELLED_MESSAGE));
        });

        test("a task that cannot be recovered does not stop the others, and is still cleaned up", async () => {
            jest.spyOn(console, "error").mockImplementation(() => undefined)
            jest.spyOn(mockTaskRepository, "getActiveTasks").mockResolvedValue([
                { ...TaskResponseModel_1, task_id: 1, task_type: "EXPORT_RAW", task_project_id: undefined, task_status: "RUNNING" },
                { ...TaskResponseModel_1, task_id: 2, task_type: "EXPORT_RAW", task_project_id: undefined, task_status: "RUNNING" },
            ])
            jest.spyOn(mockTaskRepository, "failedTask").mockRejectedValueOnce(new Error("Cannot write log")).mockResolvedValueOnce()

            await expect(recoverInterruptedTasks.execute()).resolves.toBe(1);

            expect(mockTaskRepository.failedTask).toBeCalledTimes(2);
            expect(mockTaskRepository.failedTask).toHaveBeenLastCalledWith(2, new Error(TASK_INTERRUPTED_MESSAGE));
            expect(mockTaskRepository.removeTaskWorkFiles).toBeCalledWith(1);
            expect(mockTaskRepository.removeTaskWorkFiles).toBeCalledWith(2);
        });
    });

    describe("leftovers of the interrupted work", () => {
        beforeEach(() => {
            jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue()
        })

        test("a cross-project export : only its task folder is cleaned, and the cleanup is logged", async () => {
            const task = { ...TaskResponseModel_1, task_id: 7, task_type: "EXPORT_RAW", task_project_id: undefined, task_status: "RUNNING" }
            jest.spyOn(mockTaskRepository, "getActiveTasks").mockResolvedValue([task])
            jest.spyOn(mockTaskRepository, "removeTaskWorkFiles").mockResolvedValue(["raw_export", "ecopart_export_raw_7.zip.partial"])

            await recoverInterruptedTasks.execute();

            expect(mockTaskRepository.removeTaskWorkFiles).toBeCalledWith(7);
            expect(mockProjectRepository.removeInterruptedWriteLeftovers).toBeCalledTimes(0);
            expect(mockTaskRepository.logMessage).toBeCalledWith(task.task_log_file_path, "Interrupted task cleanup, removed task folder: raw_export, ecopart_export_raw_7.zip.partial");
        });

        test("a project task : the unfinished writes of its project are removed", async () => {
            const task = { ...TaskResponseModel_1, task_id: 8, task_type: "REGENERATE_PIVOT", task_project_id: 5, task_status: "RUNNING" }
            jest.spyOn(mockTaskRepository, "getActiveTasks").mockResolvedValue([task])
            jest.spyOn(mockProjectRepository, "removeInterruptedWriteLeftovers").mockResolvedValue(["s1/pivot/s1_Particule.zip.tmp"])
            jest.spyOn(mockSampleRepository, "getSample")

            await recoverInterruptedTasks.execute();

            expect(mockProjectRepository.removeInterruptedWriteLeftovers).toBeCalledWith(5);
            expect(mockSampleRepository.getSample).toBeCalledTimes(0);
            expect(mockTaskRepository.logMessage).toBeCalledWith(task.task_log_file_path, "Interrupted task cleanup, removed unfinished writes in project 5: s1/pivot/s1_Particule.zip.tmp");
        });

        test("an import : the copies of the samples it did not create are removed, the created ones are kept", async () => {
            const task = { ...TaskResponseModel_1, task_id: 9, task_type: "IMPORT", task_project_id: 5, task_status: "RUNNING", task_params: JSON.stringify({ samples: ["created", "not_created"] }) as any }
            jest.spyOn(mockTaskRepository, "getActiveTasks").mockResolvedValue([task])
            jest.spyOn(mockSampleRepository, "getSample").mockImplementation((async (sample: any) => sample.sample_name === "created" ? {} : null) as any)
            jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder").mockResolvedValue(["data_storage/files_system_storage/5/not_created/ (3 files, 1.2 KB)"])

            await recoverInterruptedTasks.execute();

            expect(mockSampleRepository.getSample).toBeCalledWith({ sample_name: "created", project_id: 5 });
            expect(mockSampleRepository.getSample).toBeCalledWith({ sample_name: "not_created", project_id: 5 });
            expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledWith("data_storage/files_system_storage/5", ["not_created"]);
            expect(mockTaskRepository.logMessage).toBeCalledWith(task.task_log_file_path, "Interrupted task cleanup, removed copies of the samples not created: data_storage/files_system_storage/5/not_created/ (3 files, 1.2 KB)");
        });

        test("an import whose samples all exist : nothing is deleted", async () => {
            const task = { ...TaskResponseModel_1, task_id: 10, task_type: "IMPORT", task_project_id: 5, task_status: "RUNNING", task_params: JSON.stringify({ samples: ["created"] }) as any }
            jest.spyOn(mockTaskRepository, "getActiveTasks").mockResolvedValue([task])
            jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue({} as PublicSampleModel)
            jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder")

            await recoverInterruptedTasks.execute();

            expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(0);
        });

        test("a failing cleanup is reported and does not stop the recovery", async () => {
            jest.spyOn(console, "error").mockImplementation(() => undefined)
            jest.spyOn(mockTaskRepository, "getActiveTasks").mockResolvedValue([
                { ...TaskResponseModel_1, task_id: 1, task_type: "EXPORT_RAW", task_project_id: undefined, task_status: "RUNNING" },
                { ...TaskResponseModel_1, task_id: 2, task_type: "EXPORT_RAW", task_project_id: undefined, task_status: "RUNNING" },
            ])
            jest.spyOn(mockTaskRepository, "removeTaskWorkFiles").mockRejectedValueOnce(new Error("EACCES")).mockResolvedValueOnce([])

            await expect(recoverInterruptedTasks.execute()).resolves.toBe(2);

            expect(mockTaskRepository.removeTaskWorkFiles).toBeCalledTimes(2);
            expect(mockTaskRepository.logMessage).toBeCalledWith(TaskResponseModel_1.task_log_file_path, "Interrupted task cleanup failed, files may remain : EACCES");
        });

        test("what was removed before a failing step is still logged", async () => {
            jest.spyOn(console, "error").mockImplementation(() => undefined)
            const task = { ...TaskResponseModel_1, task_id: 11, task_type: "IMPORT", task_project_id: 5, task_status: "RUNNING", task_params: JSON.stringify({ samples: ["not_created"] }) as any }
            jest.spyOn(mockTaskRepository, "getActiveTasks").mockResolvedValue([task])
            jest.spyOn(mockTaskRepository, "removeTaskWorkFiles").mockResolvedValue(["import_work"])
            jest.spyOn(mockProjectRepository, "removeInterruptedWriteLeftovers").mockRejectedValue(new Error("EACCES"))

            await recoverInterruptedTasks.execute();

            expect((mockTaskRepository.logMessage as jest.Mock).mock.calls.map(([, message]) => message)).toEqual([
                "Interrupted task cleanup, removed task folder: import_work",
                "Interrupted task cleanup failed, files may remain : EACCES",
            ]);
        });

        test("an import whose copies are already gone : nothing is logged as removed", async () => {
            const task = { ...TaskResponseModel_1, task_id: 12, task_type: "IMPORT", task_project_id: 5, task_status: "RUNNING", task_params: JSON.stringify({ samples: ["not_created"] }) as any }
            jest.spyOn(mockTaskRepository, "getActiveTasks").mockResolvedValue([task])
            jest.spyOn(mockSampleRepository, "getSample").mockResolvedValue(null)
            jest.spyOn(mockSampleRepository, "deleteSamplesFromImportFolder").mockResolvedValue([])

            await recoverInterruptedTasks.execute();

            expect(mockSampleRepository.deleteSamplesFromImportFolder).toBeCalledTimes(1);
            expect(mockTaskRepository.logMessage).toBeCalledTimes(0);
        });
    });
});
