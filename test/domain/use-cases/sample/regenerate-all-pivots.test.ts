import { PivotImageRecord } from "../../../../src/domain/entities/binned-export";
import { Uvp5PivotReport } from "../../../../src/domain/entities/pivot";
import { ProjectResponseModel } from "../../../../src/domain/entities/project";
import { PublicSampleModel } from "../../../../src/domain/entities/sample";
import { TaskType } from "../../../../src/domain/entities/task";
import { TASK_CANCELLED_MESSAGE } from "../../../../src/domain/constants/task";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { PivotImages, SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { RegenerateAllPivots } from "../../../../src/domain/use-cases/sample/regenerate-all-pivots";
import { toPerImageColumns } from "../../../../src/domain/utils/per-image-columns";
import { UVP5_PIVOT_CONVERTER_VERSION } from "../../../../src/domain/utils/uvp5-pivot-converter";
import { projectResponseModel } from "../../../entities/project";
import { sampleModel_1 } from "../../../entities/sample";
import { TaskResponseModel_1, toPublicTask } from "../../../entities/task";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { MockUserRepository } from "../../../mocks/user-mock";

let mockUserRepository: UserRepository;
let mockProjectRepository: ProjectRepository;
let mockSampleRepository: SampleRepository;
let mockTaskRepository: TaskRepository;
let regenerateAllPivots: RegenerateAllPivots;

const current_user = { user_id: 1 };

const uvp5_project: ProjectResponseModel = { ...projectResponseModel, project_id: 1, instrument_model: "UVP5HD" };
const uvp5_project_2: ProjectResponseModel = { ...projectResponseModel, project_id: 3, instrument_model: "UVP5SD" };
const uvp6_project: ProjectResponseModel = { ...projectResponseModel, project_id: 2, instrument_model: "UVP6HF" };
const sample = (sample_id: number, sample_name: string): PublicSampleModel => ({ ...sampleModel_1, sample_id, sample_name });

function report(sample_name: string): Uvp5PivotReport {
    return { sample_name, converter_version: UVP5_PIVOT_CONVERTER_VERSION, frames_written: 5, frames_outside_window: 0, empty_frames: 0, frames_without_pressure: 0, duplicate_image_ids: 0, integrity_mismatches: 0 };
}

function pivot(): PivotImages {
    const records: PivotImageRecord[] = [
        { image_index: 0, image_id: "img0", raw_pressure: 1, image_time_ms: 0, light_on: true, spectrum_counts: { 2: 3 }, blocks: [{ area_px: 2, nb_particles: 3, grey_mean: 10 }] },
    ];
    return { columns: toPerImageColumns(records), rows: async function* () { yield* records; } };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository();
    mockProjectRepository = new MockProjectRepository();
    mockSampleRepository = new MockSampleRepository();
    mockTaskRepository = new MockTaskRepository();
    regenerateAllPivots = new RegenerateAllPivots(mockUserRepository, mockProjectRepository, mockSampleRepository, mockTaskRepository);
    jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValue();
    jest.spyOn(mockTaskRepository, "toPublicTask").mockImplementation(toPublicTask);
});

describe("RegenerateAllPivots", () => {
    describe("before the task", () => {
        test("rejects a user who cannot be used, before anything else", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));
            jest.spyOn(mockUserRepository, "isAdmin");

            await expect(regenerateAllPivots.execute(current_user, {})).rejects.toThrow("User cannot be used");
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
        });

        test("rejects a user who is not an administrator, without creating a task", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
            jest.spyOn(mockTaskRepository, "createTask");

            await expect(regenerateAllPivots.execute(current_user, {})).rejects.toThrow("Logged user cannot regenerate pivots");
            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
        });

        test("creates a REGENERATE_PIVOT task that belongs to no project, and returns it", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true);
            jest.spyOn(mockTaskRepository, "createTask").mockResolvedValue(TaskResponseModel_1.task_id);
            jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(TaskResponseModel_1);
            const start = jest.spyOn(regenerateAllPivots as any, "startRegenerateAllPivotsTask").mockResolvedValue(undefined);

            const task = await regenerateAllPivots.execute(current_user, { project_ids: [3, 3, 1], force: true });

            expect(task).toEqual(toPublicTask(TaskResponseModel_1));
            const created = (mockTaskRepository.createTask as jest.Mock).mock.calls[0][0];
            expect(created).toMatchObject({ task_type: TaskType.Regenerate_Pivot, task_params: { project_ids: [3, 1], force: true } });
            expect(created.task_project_id).toBeUndefined();
            expect(start).toBeCalledWith(TaskResponseModel_1, [3, 1], true);
        });
    });

    describe("the task", () => {
        beforeEach(() => {
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "countSamplesPerProject").mockImplementation(async (project_ids) => new Map((project_ids ?? []).map((id) => [id, 1])));
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockImplementation(async (options) => {
                const project_id = options.filter[0].value as number;
                return { items: [sample(project_id * 10, `s${project_id}`)], total: 1 };
            });
            jest.spyOn(mockSampleRepository, "getPivotImages").mockImplementation(async () => pivot());
            jest.spyOn(mockSampleRepository, "updateParticleStats").mockResolvedValue(1);
        });

        const loggedMessages = () => (mockTaskRepository.logMessage as jest.Mock).mock.calls.map(([, message]) => message);

        test("regenerates the samples of every UVP5 project only, and finishes with the counts", async () => {
            jest.spyOn(mockProjectRepository, "listProjects").mockResolvedValue([uvp5_project, uvp6_project, uvp5_project_2]);
            jest.spyOn(mockSampleRepository, "getPivotConverterVersion")
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(UVP5_PIVOT_CONVERTER_VERSION);
            jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockResolvedValue(report("s1"));

            await (regenerateAllPivots as any).startRegenerateAllPivotsTask(TaskResponseModel_1, [], false);

            expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(1);
            expect(mockSampleRepository.generateUvp5Pivot).toBeCalledWith(1, expect.objectContaining({ sample_name: "s1" }), "UVP5HD", uvp5_project.root_folder_path);
            expect(mockSampleRepository.updateParticleStats).toBeCalledTimes(1);
            expect(mockTaskRepository.updateTaskProgress).toBeCalledWith({ task_id: TaskResponseModel_1.task_id }, 99, `Project 3 : s3: pivot already at converter version ${UVP5_PIVOT_CONVERTER_VERSION}, kept`);
            expect(loggedMessages()[0]).toBe("2 UVP5 project(s), 2 sample(s) to look at");
            expect(mockTaskRepository.finishTask).toBeCalledWith({ task_id: TaskResponseModel_1.task_id }, "Pivots rebuilt for 1 sample(s), 1 kept, 0 failed");
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
        });

        test("skips the unknown and the non-UVP5 asked projects", async () => {
            jest.spyOn(mockProjectRepository, "getProject").mockImplementation(async ({ project_id }) =>
                project_id === 1 ? uvp5_project : project_id === 2 ? uvp6_project : null);
            jest.spyOn(mockSampleRepository, "getPivotConverterVersion").mockResolvedValue(null);
            jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockResolvedValue(report("s1"));

            await (regenerateAllPivots as any).startRegenerateAllPivotsTask(TaskResponseModel_1, [9, 2, 1], false);

            expect(loggedMessages()).toEqual(expect.arrayContaining([
                "Project 9 : not found, skipped",
                "Project 2 : skipped, pivots only exist for UVP5 projects",
            ]));
            expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(1);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
        });

        test("rebuilds an up-to-date pivot when forced", async () => {
            jest.spyOn(mockProjectRepository, "listProjects").mockResolvedValue([uvp5_project]);
            jest.spyOn(mockSampleRepository, "getPivotConverterVersion").mockResolvedValue(UVP5_PIVOT_CONVERTER_VERSION);
            jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockResolvedValue(report("s1"));

            await (regenerateAllPivots as any).startRegenerateAllPivotsTask(TaskResponseModel_1, [], true);

            expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(1);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
        });

        test("goes on after a failing sample, then fails the task with the counts", async () => {
            jest.spyOn(mockProjectRepository, "listProjects").mockResolvedValue([uvp5_project, uvp5_project_2]);
            jest.spyOn(mockSampleRepository, "getPivotConverterVersion").mockResolvedValue(null);
            jest.spyOn(mockSampleRepository, "generateUvp5Pivot")
                .mockRejectedValueOnce(new Error("Cannot build the UVP5 pivot of sample s1: boom"))
                .mockResolvedValueOnce(report("s3"));

            await (regenerateAllPivots as any).startRegenerateAllPivotsTask(TaskResponseModel_1, [], false);

            expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(2);
            expect(mockTaskRepository.updateTaskProgress).toBeCalledWith({ task_id: TaskResponseModel_1.task_id }, 50, "Project 1 : Cannot build the UVP5 pivot of sample s1: boom");
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
            expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id,
                new Error("Pivot regeneration failed for 1 of 2 sample(s): see the task log. Pivots rebuilt for 1 sample(s), 0 kept, 1 failed"));
        });

        test("a cancellation stops before the next sample", async () => {
            const cancelled = new Error(TASK_CANCELLED_MESSAGE);
            jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValueOnce().mockRejectedValue(cancelled);
            jest.spyOn(mockProjectRepository, "listProjects").mockResolvedValue([uvp5_project, uvp5_project_2]);
            jest.spyOn(mockSampleRepository, "getPivotConverterVersion").mockResolvedValue(null);
            jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockResolvedValue(report("s1"));

            await (regenerateAllPivots as any).startRegenerateAllPivotsTask(TaskResponseModel_1, [], false);

            expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(1);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
            expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, cancelled);
        });
    });
});
