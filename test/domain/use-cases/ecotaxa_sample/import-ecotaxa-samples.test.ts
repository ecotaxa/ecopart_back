import { MockUserRepository, MockEcotaxaAccountRepository } from "../../../mocks/user-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { ImportEcoTaxaSamples } from "../../../../src/domain/use-cases/ecotaxa_sample/import-ecotaxa-samples";
import { PublicSampleModel } from "../../../../src/domain/entities/sample";
import { projectResponseModel } from "../../../entities/project";
import { TaskResponseModel_1 } from "../../../entities/task";

let mockSampleRepository: MockSampleRepository;
let mockTaskRepository: MockTaskRepository;
let mockEcotaxaAccountRepository: MockEcotaxaAccountRepository;
let importEcoTaxaSamples: ImportEcoTaxaSamples;

const samples_names = ["s1", "s2"];
const importable = samples_names.map((sample_name, i) => ({ sample_id: i + 1, sample_name, images: 10, tsv_file_name: `${sample_name}.tsv`, local_folder_tsv_path: `/tmp/${sample_name}` }));
const loggedMessages = () => (mockTaskRepository.logMessage as jest.Mock).mock.calls.map(([, message]) => message);
const run = () => (importEcoTaxaSamples as any).startImportEcoTaxaSamplesTask(TaskResponseModel_1, samples_names, "UVP6M", projectResponseModel);

beforeEach(() => {
    jest.clearAllMocks();
    mockSampleRepository = new MockSampleRepository();
    mockTaskRepository = new MockTaskRepository();
    mockEcotaxaAccountRepository = new MockEcotaxaAccountRepository();
    importEcoTaxaSamples = new ImportEcoTaxaSamples(mockSampleRepository, new MockUserRepository(), new MockPrivilegeRepository(), new MockProjectRepository(), mockTaskRepository, mockEcotaxaAccountRepository, "data_storage/files_system_storage/");

    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
    jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
    jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValue();
    jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
    jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue();
    jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
    jest.spyOn(mockSampleRepository, "ensureFolderExists").mockResolvedValue();
    jest.spyOn(mockSampleRepository, "listImportableEcoTaxaSamples").mockResolvedValue(importable as any);
    jest.spyOn(mockSampleRepository, "getSamplesByIds").mockResolvedValue(importable.map(sample => ({ ...sample, visual_qc_status_label: "VALIDATED" })) as any);
    jest.spyOn(mockSampleRepository, "createManyEcoTaxaSamples").mockResolvedValue(2);
});

describe("Import EcoTaxa samples : what the task reports", () => {
    test("the EcoTaxa step logs what the repository does and follows the progress of the EcoTaxa job", async () => {
        jest.spyOn(mockEcotaxaAccountRepository, "importEcoTaxaSamplesInEcoTaxa").mockImplementation((async (_samples: unknown, _project: unknown, log: (message: string) => Promise<void>, on_job_progress: (pct: number | null, msg: string | null) => Promise<void>) => {
            await log("EcoTaxa import job 99 started on the folder from_EcoPart/1/");
            await on_job_progress(40, "Processing s1");
            await on_job_progress(null, null);
            return [];
        }) as any);

        await run();

        expect(loggedMessages()).toContain("Step 3/3 EcoTaxa import : EcoTaxa import job 99 started on the folder from_EcoPart/1/");
        expect((mockTaskRepository.updateTaskProgress as jest.Mock).mock.calls.map(([, pct, msg]) => [pct, msg])).toEqual([
            [10, "Step 1/3 EcoTaxa sample validation : start"],
            [20, "Step 1/3 EcoTaxa sample validation : done"],
            [25, "Step 2/3 EcoTaxa samples db creation : start"],
            [35, "Step 2/3 EcoTaxa samples db creation : done"],
            [40, "Step 3/3 EcoTaxa import : sending 2 sample(s) to EcoTaxa"],
            [70, "Step 3/3 EcoTaxa import : EcoTaxa job at 40%, Processing s1"],
            [50, "Step 3/3 EcoTaxa import : EcoTaxa job at ?%"],
        ]);
        expect(mockTaskRepository.finishTask).toBeCalledWith({ task_id: TaskResponseModel_1.task_id });
    });
});

describe("Import EcoTaxa samples : rollback of the database flags", () => {
    test("a failure after the flags are written resets every flagged sample, found by id, and logs them", async () => {
        const ecotaxaError = new Error("EcoTaxa is down");
        jest.spyOn(mockEcotaxaAccountRepository, "importEcoTaxaSamplesInEcoTaxa").mockRejectedValue(ecotaxaError);
        const flagged = importable.map(sample => ({ ...sample, project_id: 1, visual_qc_status_label: "VALIDATED", ecotaxa_sample_imported: true }) as unknown as PublicSampleModel);
        jest.spyOn(mockSampleRepository, "getSamplesByIds").mockResolvedValue(flagged);
        jest.spyOn(mockSampleRepository, "deleteEcoTaxaSamplesFromDb").mockResolvedValue(2);

        await run();

        // By id: a sample name is unique only within its project
        expect(mockSampleRepository.getSamplesByIds).toHaveBeenLastCalledWith([1, 2]);
        expect(mockSampleRepository.deleteEcoTaxaSamplesFromDb).toBeCalledWith(flagged);
        expect(loggedMessages()).toEqual([
            "Step 1/3 EcoTaxa sample validation : 2 sample(s) to send to EcoTaxa out of 2 importable",
            "Step 2/3 EcoTaxa samples db creation : s1 (sample_id 1) marked as imported into EcoTaxa, 10 image(s), s1.tsv",
            "Step 2/3 EcoTaxa samples db creation : s2 (sample_id 2) marked as imported into EcoTaxa, 10 image(s), s2.tsv",
            "Cleanup after failure : resetting the EcoTaxa import fields in the database for : s1, s2",
            "Cleanup after failure : EcoTaxa import fields reset for s1 (sample_id 1, project 1), s2 (sample_id 2, project 1)",
        ]);
        expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, ecotaxaError);
    });

    test("a failure before any flag is written : nothing to reset, and the task still fails", async () => {
        const dbError = new Error("SQLITE_BUSY");
        jest.spyOn(mockSampleRepository, "createManyEcoTaxaSamples").mockRejectedValue(dbError);
        jest.spyOn(mockSampleRepository, "deleteEcoTaxaSamplesFromDb");

        await run();

        expect(mockSampleRepository.deleteEcoTaxaSamplesFromDb).toBeCalledTimes(0);
        expect(loggedMessages()).toContain("Cleanup after failure : nothing reset, no sample is marked as imported in EcoTaxa");
        expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, dbError);
    });

    test("a failing reset is logged, and the task still fails with its own error", async () => {
        const ecotaxaError = new Error("EcoTaxa is down");
        jest.spyOn(mockEcotaxaAccountRepository, "importEcoTaxaSamplesInEcoTaxa").mockRejectedValue(ecotaxaError);
        // the visual QC gate reads the samples, then the reset fails to
        jest.spyOn(mockSampleRepository, "getSamplesByIds")
            .mockResolvedValueOnce(importable.map(sample => ({ ...sample, visual_qc_status_label: "VALIDATED" })) as any)
            .mockRejectedValueOnce(new Error("SQLITE_BUSY"));

        await run();

        expect(loggedMessages()).toContain("Cleanup after failure : reset failed, samples may remain marked as imported in EcoTaxa : SQLITE_BUSY");
        expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, ecotaxaError);
    });
});
