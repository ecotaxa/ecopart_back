import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { InstrumentModelRepository } from "../../../../src/domain/interfaces/repositories/instrument_model-repository";

import { MockUserRepository, MockEcotaxaAccountRepository } from "../../../mocks/user-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { MockInstrumentModelRepository } from "../../../mocks/instrumentModel-mock";

import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { PublicSampleModel } from "../../../../src/domain/entities/sample";
import { ExportRawData } from "../../../../src/domain/use-cases/export/export-raw-data";
import { ExportRawDataUseCase, RawExportType } from "../../../../src/domain/interfaces/use-cases/export/export-raw-data";

import { sampleModel_1, sampleModel_2 } from "../../../entities/sample";
import { private_projectResponseModel } from "../../../entities/project";
import { TaskResponseModel_1 } from "../../../entities/task";

let mockUserRepository: UserRepository;
let mockPrivilegeRepository: MockPrivilegeRepository;
let mockProjectRepository: ProjectRepository;
let mockSampleRepository: SampleRepository;
let mockTaskRepository: TaskRepository;
let mockEcotaxaAccountRepository: MockEcotaxaAccountRepository;
let mockInstrumentModelRepository: InstrumentModelRepository;
let exportRawDataUseCase: ExportRawDataUseCase;

const current_user: UserUpdateModel = { user_id: 1 };

// The fixtures ship `visual_qc_status_label: "PENDING"`, which the QC gate rejects — so any
// test that needs to get *past* the gate builds its samples from these helpers.
const validated = (sample: PublicSampleModel, overrides: Partial<PublicSampleModel> = {}): PublicSampleModel =>
    ({ ...sample, visual_qc_status_label: "VALIDATED", ...overrides });

// `runExport` is deliberately fire-and-forget: `execute` returns the task and the archive is
// built in the background. These are unit tests of the synchronous contract, so every test
// makes `startTask` reject — the background work then stops at its first step and lands in the
// use case's own catch (`failedTask`), instead of touching the filesystem or leaking an
// unhandled rejection into the next test.
function stubBackgroundWork() {
    jest.spyOn(mockTaskRepository, "startTask").mockImplementation(() => Promise.reject(new Error("background work stopped by test")));
    jest.spyOn(mockTaskRepository, "failedTask").mockImplementation(() => Promise.resolve());
    jest.spyOn(mockTaskRepository, "finishTask").mockImplementation(() => Promise.resolve());
}

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository();
    mockPrivilegeRepository = new MockPrivilegeRepository();
    mockProjectRepository = new MockProjectRepository();
    mockSampleRepository = new MockSampleRepository();
    mockTaskRepository = new MockTaskRepository();
    mockEcotaxaAccountRepository = new MockEcotaxaAccountRepository();
    mockInstrumentModelRepository = new MockInstrumentModelRepository();

    exportRawDataUseCase = new ExportRawData(
        mockUserRepository,
        mockPrivilegeRepository,
        mockProjectRepository,
        mockSampleRepository,
        mockTaskRepository,
        mockEcotaxaAccountRepository,
        mockInstrumentModelRepository,
        "data_storage/",
        "http://localhost:3000",
    );
});

describe("ExportRawDataUseCase", () => {
    describe("authorization", () => {
        test("deleted or invalid user cannot export raw data", async () => {
            const outputError = new Error("User cannot be used");
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.reject(outputError));
            jest.spyOn(mockSampleRepository, "getSamplesByIds");
            jest.spyOn(mockTaskRepository, "createTask");

            await expect(exportRawDataUseCase.execute(current_user, { sample_ids: [1], export_types: ["metadata"] }))
                .rejects.toThrow(outputError);

            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledTimes(1);
            expect(mockUserRepository.ensureUserCanBeUsed).toBeCalledWith(current_user.user_id);
            // The user check gates everything: no lookup, no task.
            expect(mockSampleRepository.getSamplesByIds).toBeCalledTimes(0);
            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
        });

        test("non-admin without privilege on the project cannot export its samples", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockSampleRepository, "getSamplesByIds").mockImplementation(() => Promise.resolve([validated(sampleModel_1)]));
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockProjectRepository, "getProject");
            jest.spyOn(mockTaskRepository, "createTask");

            await expect(exportRawDataUseCase.execute(current_user, { sample_ids: [1], export_types: ["metadata"] }))
                .rejects.toThrow(`Logged user cannot export raw data from project ${sampleModel_1.project_id}`);

            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: sampleModel_1.project_id });
            expect(mockProjectRepository.getProject).toBeCalledTimes(0);
            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
        });

        test("admin does not need an explicit privilege", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockSampleRepository, "getSamplesByIds").mockImplementation(() => Promise.resolve([validated(sampleModel_1)]));
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockPrivilegeRepository, "isGranted");
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(private_projectResponseModel));
            jest.spyOn(mockTaskRepository, "createTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1.task_id));
            jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1));
            stubBackgroundWork();

            const task = await exportRawDataUseCase.execute(current_user, { sample_ids: [1], export_types: ["metadata"] });

            expect(task).toStrictEqual(TaskResponseModel_1);
            expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(0);
        });

        test("each distinct project of a cross-project export is authorized separately", async () => {
            const samples = [validated(sampleModel_1), validated(sampleModel_2)];
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockSampleRepository, "getSamplesByIds").mockImplementation(() => Promise.resolve(samples));
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(false));
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(private_projectResponseModel));
            jest.spyOn(mockTaskRepository, "createTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1.task_id));
            jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1));
            stubBackgroundWork();

            await exportRawDataUseCase.execute(current_user, { sample_ids: [1, 2], export_types: ["metadata"] });

            // Two samples in two different projects → one privilege check and one lookup each.
            expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(2);
            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: sampleModel_1.project_id });
            expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: current_user.user_id, project_id: sampleModel_2.project_id });
            expect(mockProjectRepository.getProject).toBeCalledTimes(2);
        });

        test("a project that cannot be resolved aborts the export", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockSampleRepository, "getSamplesByIds").mockImplementation(() => Promise.resolve([validated(sampleModel_1)]));
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(null));
            jest.spyOn(mockTaskRepository, "createTask");

            await expect(exportRawDataUseCase.execute(current_user, { sample_ids: [1], export_types: ["metadata"] }))
                .rejects.toThrow("Cannot find project");

            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
        });
    });

    describe("request validation", () => {
        beforeEach(() => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockSampleRepository, "getSamplesByIds");
            jest.spyOn(mockTaskRepository, "createTask");
        });

        // Validation happens in the use case as well as in the router middleware: the use case
        // is the layer that must hold even when called from a non-HTTP entry point.
        const invalid: Array<[string, any, string]> = [
            ["sample_ids missing", { export_types: ["metadata"] }, "sample_ids must be a non-empty array"],
            ["sample_ids empty", { sample_ids: [], export_types: ["metadata"] }, "sample_ids must be a non-empty array"],
            ["sample_ids not an array", { sample_ids: 1, export_types: ["metadata"] }, "sample_ids must be a non-empty array"],
            ["sample_ids zero", { sample_ids: [0], export_types: ["metadata"] }, "sample_ids must be positive integers"],
            ["sample_ids negative", { sample_ids: [-3], export_types: ["metadata"] }, "sample_ids must be positive integers"],
            ["sample_ids not numeric", { sample_ids: ["abc"], export_types: ["metadata"] }, "sample_ids must be positive integers"],
            ["export_types missing", { sample_ids: [1] }, "export_types must be a non-empty array"],
            ["export_types empty", { sample_ids: [1], export_types: [] }, "export_types must be a non-empty array"],
            ["export_types unknown value", { sample_ids: [1], export_types: ["particles"] }, "Unknown export type: particles"],
        ];

        test.each(invalid)("rejects %s", async (_label, request, expectedMessage) => {
            await expect(exportRawDataUseCase.execute(current_user, request)).rejects.toThrow(expectedMessage);

            // Validation runs before any lookup, so nothing downstream is touched.
            expect(mockSampleRepository.getSamplesByIds).toBeCalledTimes(0);
            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
        });

        test("duplicate export types are deduplicated in the created task", async () => {
            jest.spyOn(mockSampleRepository, "getSamplesByIds").mockImplementation(() => Promise.resolve([validated(sampleModel_1)]));
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(private_projectResponseModel));
            jest.spyOn(mockTaskRepository, "createTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1.task_id));
            jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1));
            stubBackgroundWork();

            await exportRawDataUseCase.execute(current_user, {
                sample_ids: [1],
                export_types: ["metadata", "metadata", "lpm"] as RawExportType[],
            });

            expect(mockTaskRepository.createTask).toBeCalledWith(expect.objectContaining({
                task_params: expect.objectContaining({ export_types: ["metadata", "lpm"] }),
            }));
        });
    });

    describe("sample resolution", () => {
        beforeEach(() => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockTaskRepository, "createTask");
        });

        test("no sample resolved at all is reported as not found", async () => {
            jest.spyOn(mockSampleRepository, "getSamplesByIds").mockImplementation(() => Promise.resolve([]));

            await expect(exportRawDataUseCase.execute(current_user, { sample_ids: [1], export_types: ["metadata"] }))
                .rejects.toThrow("No samples found");

            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
        });

        test("partially resolved ids report exactly the missing ones", async () => {
            // Asked for 1, 2 and 7 — the repository only knows 1.
            jest.spyOn(mockSampleRepository, "getSamplesByIds").mockImplementation(() => Promise.resolve([validated(sampleModel_1)]));

            await expect(exportRawDataUseCase.execute(current_user, { sample_ids: [1, 2, 7], export_types: ["metadata"] }))
                .rejects.toThrow("Sample(s) not found: 2, 7");

            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
        });
    });

    describe("visual QC gate", () => {
        beforeEach(() => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockProjectRepository, "getProject");
            jest.spyOn(mockTaskRepository, "createTask");
        });

        test("a PENDING sample blocks the export and is named in the error", async () => {
            jest.spyOn(mockSampleRepository, "getSamplesByIds").mockImplementation(() => Promise.resolve([sampleModel_1]));

            await expect(exportRawDataUseCase.execute(current_user, { sample_ids: [1], export_types: ["metadata"] }))
                .rejects.toThrow(`Sample(s) not validated: ${sampleModel_1.sample_name}`);

            // The gate runs before project authorization, so nothing further is reached.
            expect(mockProjectRepository.getProject).toBeCalledTimes(0);
            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
        });

        test("a REJECTED sample blocks the export too", async () => {
            jest.spyOn(mockSampleRepository, "getSamplesByIds")
                .mockImplementation(() => Promise.resolve([validated(sampleModel_1, { visual_qc_status_label: "REJECTED" })]));

            await expect(exportRawDataUseCase.execute(current_user, { sample_ids: [1], export_types: ["metadata"] }))
                .rejects.toThrow(`Sample(s) not validated: ${sampleModel_1.sample_name}`);

            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
        });

        test("every non-validated sample is listed, not just the first", async () => {
            jest.spyOn(mockSampleRepository, "getSamplesByIds")
                .mockImplementation(() => Promise.resolve([sampleModel_1, sampleModel_2]));

            await expect(exportRawDataUseCase.execute(current_user, { sample_ids: [1, 2], export_types: ["metadata"] }))
                .rejects.toThrow(`Sample(s) not validated: ${sampleModel_1.sample_name}, ${sampleModel_2.sample_name}`);
        });

        test("a mix of validated and not-validated samples still blocks the whole export", async () => {
            jest.spyOn(mockSampleRepository, "getSamplesByIds")
                .mockImplementation(() => Promise.resolve([validated(sampleModel_1), sampleModel_2]));

            await expect(exportRawDataUseCase.execute(current_user, { sample_ids: [1, 2], export_types: ["metadata"] }))
                .rejects.toThrow(`Sample(s) not validated: ${sampleModel_2.sample_name}`);

            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
        });

        describe("skip_not_validated", () => {
            test("exports the validated samples only, and records the choice on the task", async () => {
                jest.spyOn(mockSampleRepository, "getSamplesByIds")
                    .mockImplementation(() => Promise.resolve([validated(sampleModel_1), sampleModel_2]));
                jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(private_projectResponseModel));
                jest.spyOn(mockTaskRepository, "createTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1.task_id));
                jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1));
                stubBackgroundWork();

                const task = await exportRawDataUseCase.execute(current_user,
                    { sample_ids: [1, 2], export_types: ["metadata"], skip_not_validated: true });

                expect(task).toStrictEqual(TaskResponseModel_1);
                expect(mockTaskRepository.createTask).toBeCalledWith(expect.objectContaining({
                    task_params: { sample_ids: [1, 2], export_types: ["metadata"], ecotaxa_exclude_not_living: false, skip_not_validated: true },
                }));
                // Only the validated sample's project is authorized/resolved.
                expect(mockProjectRepository.getProject).toBeCalledTimes(1);
                expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: sampleModel_1.project_id });
            });

            test("still refuses the export when no validated sample remains", async () => {
                jest.spyOn(mockSampleRepository, "getSamplesByIds")
                    .mockImplementation(() => Promise.resolve([sampleModel_1, sampleModel_2]));

                await expect(exportRawDataUseCase.execute(current_user,
                    { sample_ids: [1, 2], export_types: ["metadata"], skip_not_validated: true }))
                    .rejects.toThrow(`Sample(s) not validated: ${sampleModel_1.sample_name}, ${sampleModel_2.sample_name}`);

                expect(mockTaskRepository.createTask).toBeCalledTimes(0);
            });

            test("defaults to false: an explicit false behaves like the flag being absent", async () => {
                jest.spyOn(mockSampleRepository, "getSamplesByIds")
                    .mockImplementation(() => Promise.resolve([validated(sampleModel_1), sampleModel_2]));

                await expect(exportRawDataUseCase.execute(current_user,
                    { sample_ids: [1, 2], export_types: ["metadata"], skip_not_validated: false }))
                    .rejects.toThrow(`Sample(s) not validated: ${sampleModel_2.sample_name}`);

                expect(mockTaskRepository.createTask).toBeCalledTimes(0);
            });
        });
    });

    describe("task creation", () => {
        beforeEach(() => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
            jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(() => Promise.resolve(private_projectResponseModel));
        });

        test("the task carries the owner, the export params and no project id", async () => {
            jest.spyOn(mockSampleRepository, "getSamplesByIds").mockImplementation(() => Promise.resolve([validated(sampleModel_1)]));
            jest.spyOn(mockTaskRepository, "createTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1.task_id));
            jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1));
            stubBackgroundWork();

            const task = await exportRawDataUseCase.execute(current_user, {
                sample_ids: [1],
                export_types: ["metadata", "ecotaxa"],
                ecotaxa_exclude_not_living: true,
            });

            expect(task).toStrictEqual(TaskResponseModel_1);
            expect(mockTaskRepository.createTask).toBeCalledWith(expect.objectContaining({
                task_type: "EXPORT_RAW",
                task_status: "PENDING",
                task_owner_id: current_user.user_id,
                task_params: {
                    sample_ids: [1],
                    export_types: ["metadata", "ecotaxa"],
                    ecotaxa_exclude_not_living: true,
                    skip_not_validated: false,
                },
            }));
            // Cross-project export: the task is deliberately not tied to a single project.
            const created = (mockTaskRepository.createTask as jest.Mock).mock.calls[0][0];
            expect(created.task_project_id).toBeUndefined();
        });

        test("a missing ecotaxa_exclude_not_living defaults to false", async () => {
            jest.spyOn(mockSampleRepository, "getSamplesByIds").mockImplementation(() => Promise.resolve([validated(sampleModel_1)]));
            jest.spyOn(mockTaskRepository, "createTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1.task_id));
            jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1));
            stubBackgroundWork();

            await exportRawDataUseCase.execute(current_user, { sample_ids: [1], export_types: ["ecotaxa"] });

            expect(mockTaskRepository.createTask).toBeCalledWith(expect.objectContaining({
                task_params: expect.objectContaining({ ecotaxa_exclude_not_living: false }),
            }));
        });

        test("a task that cannot be read back aborts before any background work", async () => {
            jest.spyOn(mockSampleRepository, "getSamplesByIds").mockImplementation(() => Promise.resolve([validated(sampleModel_1)]));
            jest.spyOn(mockTaskRepository, "createTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1.task_id));
            jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(null));
            jest.spyOn(mockTaskRepository, "startTask");

            await expect(exportRawDataUseCase.execute(current_user, { sample_ids: [1], export_types: ["metadata"] }))
                .rejects.toThrow("Cannot find task");

            expect(mockTaskRepository.startTask).toBeCalledTimes(0);
        });
    });
});
