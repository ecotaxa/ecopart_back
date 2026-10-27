import { PivotImageRecord } from "../../../../src/domain/entities/binned-export";
import { ProjectResponseModel } from "../../../../src/domain/entities/project";
import { PublicSampleModel } from "../../../../src/domain/entities/sample";
import { TaskType } from "../../../../src/domain/entities/task";
import { TASK_CANCELLED_MESSAGE } from "../../../../src/domain/constants/task";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { PivotImages, SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { ComputeParticleStats } from "../../../../src/domain/use-cases/sample/compute-particle-stats";
import { toPerImageColumns } from "../../../../src/domain/utils/per-image-columns";
import { projectResponseModel } from "../../../entities/project";
import { sampleModel_1, sampleModel_2 } from "../../../entities/sample";
import { TaskResponseModel_1, toPublicTask } from "../../../entities/task";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { MockUserRepository } from "../../../mocks/user-mock";

let mockUserRepository: UserRepository;
let mockProjectRepository: ProjectRepository;
let mockSampleRepository: SampleRepository;
let mockTaskRepository: TaskRepository;
let computeParticleStats: ComputeParticleStats;

const current_user = { user_id: 1 };

// A pivot of two lit images: 3 particles of 2 px and one of 40 px.
function pivot(): PivotImages {
    const records: PivotImageRecord[] = [
        { image_index: 0, image_id: "img0", raw_pressure: 1, image_time_ms: 0, light_on: true, spectrum_counts: { 2: 3 }, blocks: [{ area_px: 2, nb_particles: 3, grey_mean: 10 }] },
        { image_index: 1, image_id: "img1", raw_pressure: 2, image_time_ms: 1000, light_on: true, spectrum_counts: { 40: 1 }, blocks: [{ area_px: 40, nb_particles: 1, grey_mean: 10 }] },
    ];
    return { columns: toPerImageColumns(records), rows: async function* () { yield* records; } };
}
// It goes down: the descent filter keeps every image.
const STATS = { nb_particles: 4, particle_min_area_px: 2, particle_max_area_px: 40, nb_particles_descent_filter: 4, particle_min_area_px_descent_filter: 2, particle_max_area_px_descent_filter: 40 };
const COMPUTED = { nb_particles: 7, particle_min_area_px: 1, particle_max_area_px: 9, nb_particles_descent_filter: 5, particle_min_area_px_descent_filter: 1, particle_max_area_px_descent_filter: 9 };

const uvp5_project: ProjectResponseModel = { ...projectResponseModel, project_id: 1, instrument_model: "UVP5HD" };
const uvp6_project: ProjectResponseModel = { ...projectResponseModel, project_id: 2, instrument_model: "UVP6HF" };
const sample = (sample_id: number, sample_name: string, overrides: Partial<PublicSampleModel> = {}): PublicSampleModel =>
    ({ ...sampleModel_1, sample_id, sample_name, ...overrides });

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository();
    mockProjectRepository = new MockProjectRepository();
    mockSampleRepository = new MockSampleRepository();
    mockTaskRepository = new MockTaskRepository();
    computeParticleStats = new ComputeParticleStats(mockUserRepository, mockProjectRepository, mockSampleRepository, mockTaskRepository);
    // Defaults: a task that is never cancelled, returned without its log file path
    jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValue();
    jest.spyOn(mockTaskRepository, "toPublicTask").mockImplementation(toPublicTask);
});

describe("ComputeParticleStats", () => {
    describe("before the task", () => {
        test("rejects a user who cannot be used, before anything else", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));
            jest.spyOn(mockUserRepository, "isAdmin");
            jest.spyOn(mockTaskRepository, "createTask");

            await expect(computeParticleStats.execute(current_user, {})).rejects.toThrow("User cannot be used");
            expect(mockUserRepository.isAdmin).toBeCalledTimes(0);
            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
        });

        test("rejects a user who is not an administrator, without creating a task", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
            jest.spyOn(mockTaskRepository, "createTask");

            await expect(computeParticleStats.execute(current_user, { force: true })).rejects.toThrow("Logged user cannot compute particle stats");
            expect(mockUserRepository.isAdmin).toBeCalledWith(current_user.user_id);
            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
        });

        test("creates a COMPUTE_PARTICLE_STATS task outside any project, returns it and starts it", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true);
            jest.spyOn(mockTaskRepository, "createTask").mockResolvedValue(TaskResponseModel_1.task_id);
            jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(TaskResponseModel_1);
            const start = jest.spyOn(computeParticleStats as any, "startComputeParticleStatsTask").mockResolvedValue(undefined);

            const task = await computeParticleStats.execute(current_user, { project_ids: [3, 1, 3], force: true });

            expect(task).toEqual(toPublicTask(TaskResponseModel_1));
            const created = (mockTaskRepository.createTask as jest.Mock).mock.calls[0][0];
            expect(created).toEqual({ task_type: TaskType.Compute_Particle_Stats, task_status: "PENDING", task_owner_id: current_user.user_id, task_params: { project_ids: [3, 1], force: true } });
            expect(created).not.toHaveProperty("task_project_id");
            expect(start).toBeCalledWith(TaskResponseModel_1, [3, 1], true);
        });

        test("without options, every project and no forcing", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true);
            jest.spyOn(mockTaskRepository, "createTask").mockResolvedValue(TaskResponseModel_1.task_id);
            jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(TaskResponseModel_1);
            const start = jest.spyOn(computeParticleStats as any, "startComputeParticleStatsTask").mockResolvedValue(undefined);

            await computeParticleStats.execute(current_user, {});

            expect(mockTaskRepository.createTask).toBeCalledWith(expect.objectContaining({ task_params: { project_ids: [], force: false } }));
            expect(start).toBeCalledWith(TaskResponseModel_1, [], false);
        });

        test("fails when the created task cannot be read back", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true);
            jest.spyOn(mockTaskRepository, "createTask").mockResolvedValue(TaskResponseModel_1.task_id);
            jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(null);
            const start = jest.spyOn(computeParticleStats as any, "startComputeParticleStatsTask");

            await expect(computeParticleStats.execute(current_user, {})).rejects.toThrow("Cannot find task");
            expect(start).toBeCalledTimes(0);
        });
    });

    describe("the task", () => {
        const progressMessages = () => (mockTaskRepository.updateTaskProgress as jest.Mock).mock.calls.map(([, pct, msg]) => [pct, msg]);
        const loggedMessages = () => (mockTaskRepository.logMessage as jest.Mock).mock.calls.map(([, message]) => message);
        const run = (project_ids: number[], force: boolean) =>
            (computeParticleStats as any).startComputeParticleStatsTask(TaskResponseModel_1, project_ids, force);

        beforeEach(() => {
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "getPivotConverterVersion").mockResolvedValue("2");
            jest.spyOn(mockSampleRepository, "getPivotImages").mockImplementation(async () => pivot());
            jest.spyOn(mockSampleRepository, "updateParticleStats").mockResolvedValue(1);
            jest.spyOn(mockSampleRepository, "countSamplesPerProject").mockImplementation(async (project_ids) => new Map((project_ids ?? []).map((id) => [id, 2])));
        });

        test("computes the samples of every project that have no statistics yet, keeps the others", async () => {
            jest.spyOn(mockProjectRepository, "listProjects").mockResolvedValue([uvp5_project, uvp6_project]);
            jest.spyOn(mockSampleRepository, "standardGetSamples")
                .mockResolvedValueOnce({ items: [sample(11, "uvp5_a"), sample(12, "uvp5_b", COMPUTED)], total: 2 })
                .mockResolvedValueOnce({ items: [sample(21, "uvp6_a"), sample(22, "uvp6_b", { nb_particles: 0, particle_min_area_px: null, particle_max_area_px: null, nb_particles_descent_filter: 0, particle_min_area_px_descent_filter: null, particle_max_area_px_descent_filter: null })], total: 2 });

            await run([], false);

            expect(mockProjectRepository.listProjects).toBeCalledTimes(1);
            expect(mockSampleRepository.standardGetSamples).toBeCalledWith({ filter: [{ field: "project_id", operator: "=", value: 1 }], sort_by: [], page: 1, limit: 10000000 });
            expect(mockSampleRepository.getPivotImages).toBeCalledTimes(2);
            expect(mockSampleRepository.getPivotImages).toBeCalledWith(1, "uvp5_a", "UVP5HD");
            expect(mockSampleRepository.getPivotImages).toBeCalledWith(2, "uvp6_a", "UVP6HF");
            expect(mockSampleRepository.updateParticleStats).toBeCalledTimes(2);
            expect(mockSampleRepository.updateParticleStats).toBeCalledWith(11, STATS);
            expect(mockSampleRepository.updateParticleStats).toBeCalledWith(21, STATS);
            expect(progressMessages()).toEqual([
                [25, "Project 1 : uvp5_a: 4 particle(s) counted, areas from 2 to 40 px"],
                [50, "Project 1 : uvp5_b: particle statistics already computed, kept"],
                [74, "Project 2 : uvp6_a: 4 particle(s) counted, areas from 2 to 40 px"],
                [99, "Project 2 : uvp6_b: particle statistics already computed, kept"],
            ]);
            const summary = "Particle statistics computed for 2 sample(s), 2 skipped, 0 failed";
            expect(loggedMessages()).toEqual(["2 project(s), 4 sample(s) to look at", summary]);
            expect(mockTaskRepository.finishTask).toBeCalledWith({ task_id: TaskResponseModel_1.task_id }, summary);
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
        });

        test("forced, recomputes the samples that already have statistics", async () => {
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(uvp6_project);
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockResolvedValue({ items: [sample(21, "uvp6_a", COMPUTED)], total: 1 });

            await run([2], true);

            expect(mockProjectRepository.getProject).toBeCalledWith({ project_id: 2 });
            expect(mockSampleRepository.updateParticleStats).toBeCalledWith(21, STATS);
            expect(mockTaskRepository.finishTask).toBeCalledWith({ task_id: TaskResponseModel_1.task_id }, "Particle statistics computed for 1 sample(s), 0 skipped, 0 failed");
        });

        test("computes a sample that has only the statistics over the operator window", async () => {
            jest.spyOn(mockProjectRepository, "listProjects").mockResolvedValue([uvp6_project]);
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockResolvedValue({ items: [sample(21, "uvp6_a", { ...COMPUTED, nb_particles_descent_filter: null })], total: 1 });

            await run([], false);

            expect(mockSampleRepository.updateParticleStats).toBeCalledWith(21, STATS);
        });

        test("skips an unknown project id with a log line, and lists no project", async () => {
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValueOnce(null).mockResolvedValueOnce(uvp6_project);
            jest.spyOn(mockProjectRepository, "listProjects");
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockResolvedValue({ items: [sample(21, "uvp6_a")], total: 1 });

            await run([404, 2], false);

            expect(mockProjectRepository.listProjects).toBeCalledTimes(0);
            expect(mockSampleRepository.countSamplesPerProject).toBeCalledWith([2]);
            expect(mockSampleRepository.standardGetSamples).toBeCalledTimes(1);
            expect(loggedMessages()[0]).toBe("Project 404 : not found, skipped");
            expect(mockSampleRepository.updateParticleStats).toBeCalledWith(21, STATS);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
        });

        test("skips a UVP5 sample without pivot, telling to regenerate the pivots of its project", async () => {
            jest.spyOn(mockProjectRepository, "listProjects").mockResolvedValue([uvp5_project]);
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockResolvedValue({ items: [sample(11, "uvp5_a"), sample(12, "uvp5_b")], total: 2 });
            jest.spyOn(mockSampleRepository, "getPivotConverterVersion").mockResolvedValueOnce(null).mockResolvedValueOnce("2");

            await run([], false);

            expect(mockSampleRepository.getPivotConverterVersion).toBeCalledWith(1, "uvp5_a");
            expect(mockSampleRepository.getPivotImages).toBeCalledTimes(1);
            expect(mockSampleRepository.getPivotImages).toBeCalledWith(1, "uvp5_b", "UVP5HD");
            expect(mockSampleRepository.updateParticleStats).toBeCalledTimes(1);
            expect(progressMessages()[0]).toEqual([50, "Project 1 : uvp5_a: skipped, the sample has no pivot. Run the pivot regeneration of project 1, which also computes its particle statistics"]);
            expect(mockTaskRepository.finishTask).toBeCalledWith({ task_id: TaskResponseModel_1.task_id }, "Particle statistics computed for 1 sample(s), 1 skipped, 0 failed");
        });

        test("skips the samples of an instrument that is neither a UVP5 nor a UVP6, without reading anything", async () => {
            jest.spyOn(mockProjectRepository, "listProjects").mockResolvedValue([{ ...uvp6_project, instrument_model: "CPICS" }]);
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockResolvedValue({ items: [sample(21, "cpics_a")], total: 1 });

            await run([], false);

            expect(mockSampleRepository.getPivotConverterVersion).toBeCalledTimes(0);
            expect(mockSampleRepository.getPivotImages).toBeCalledTimes(0);
            expect(mockSampleRepository.updateParticleStats).toBeCalledTimes(0);
            expect(progressMessages()).toEqual([[50, "Project 2 : cpics_a: skipped, no particle statistics for the instrument CPICS"]]);
            expect(mockTaskRepository.finishTask).toBeCalledWith({ task_id: TaskResponseModel_1.task_id }, "Particle statistics computed for 0 sample(s), 1 skipped, 0 failed");
        });

        test("goes on after a failing sample, which is counted and logged, and the task still finishes", async () => {
            jest.spyOn(mockProjectRepository, "listProjects").mockResolvedValue([uvp6_project]);
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockResolvedValue({ items: [sample(21, "uvp6_a"), sample(22, "uvp6_b")], total: 2 });
            jest.spyOn(mockSampleRepository, "getPivotImages")
                .mockRejectedValueOnce(new Error("Cannot read the particle file of sample uvp6_a (no such file)"))
                .mockImplementationOnce(async () => pivot());

            await run([], false);

            expect(mockSampleRepository.updateParticleStats).toBeCalledTimes(1);
            expect(mockSampleRepository.updateParticleStats).toBeCalledWith(22, STATS);
            expect(progressMessages()[0]).toEqual([50, "Project 2 : uvp6_a: FAILED Cannot read the particle file of sample uvp6_a (no such file)"]);
            expect(mockTaskRepository.finishTask).toBeCalledWith({ task_id: TaskResponseModel_1.task_id }, "Particle statistics computed for 1 sample(s), 0 skipped, 1 failed");
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
        });

        test("a cancellation stops before the next sample, the statistics already written are kept", async () => {
            const cancelled = new Error(TASK_CANCELLED_MESSAGE);
            jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValueOnce().mockRejectedValue(cancelled);
            jest.spyOn(mockProjectRepository, "listProjects").mockResolvedValue([uvp6_project]);
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockResolvedValue({ items: [sample(21, "uvp6_a"), sample(22, "uvp6_b")], total: 2 });

            await run([], false);

            expect(mockSampleRepository.updateParticleStats).toBeCalledTimes(1);
            expect(mockSampleRepository.updateParticleStats).toBeCalledWith(21, STATS);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
            expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, cancelled);
        });

        test("an unexpected error fails the task", async () => {
            const error = new Error("SQLITE_BUSY: database is locked");
            jest.spyOn(mockProjectRepository, "listProjects").mockRejectedValue(error);
            jest.spyOn(mockSampleRepository, "standardGetSamples");

            await run([], false);

            expect(mockSampleRepository.standardGetSamples).toBeCalledTimes(0);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
            expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, error);
        });
    });
});
