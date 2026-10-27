import { Uvp5PivotReport } from "../../../../src/domain/entities/pivot";
import { PivotImageRecord } from "../../../../src/domain/entities/binned-export";
import { PivotImages } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { toPerImageColumns } from "../../../../src/domain/utils/per-image-columns";
import { TaskType } from "../../../../src/domain/entities/task";
import { PrivilegeRepository } from "../../../../src/domain/interfaces/repositories/privilege-repository";
import { ProjectRepository } from "../../../../src/domain/interfaces/repositories/project-repository";
import { SampleRepository } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { TaskRepository } from "../../../../src/domain/interfaces/repositories/task-repository";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { RegeneratePivots } from "../../../../src/domain/use-cases/sample/regenerate-pivots";
import { UVP5_PIVOT_CONVERTER_VERSION } from "../../../../src/domain/utils/uvp5-pivot-converter";
import { projectResponseModel } from "../../../entities/project";
import { sampleModel_1, sampleModel_2 } from "../../../entities/sample";
import { TaskResponseModel_1, toPublicTask } from "../../../entities/task";
import { TASK_CANCELLED_MESSAGE } from "../../../../src/domain/constants/task";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { MockUserRepository } from "../../../mocks/user-mock";

let mockUserRepository: UserRepository;
let mockPrivilegeRepository: PrivilegeRepository;
let mockProjectRepository: ProjectRepository;
let mockSampleRepository: SampleRepository;
let mockTaskRepository: TaskRepository;
let regeneratePivots: RegeneratePivots;

const current_user = { user_id: 1 };

function report(sample_name: string): Uvp5PivotReport {
    return { sample_name, converter_version: UVP5_PIVOT_CONVERTER_VERSION, frames_written: 5, frames_outside_window: 0, empty_frames: 0, frames_without_pressure: 0, duplicate_image_ids: 0, integrity_mismatches: 0 };
}

// A pivot of three lit images going down, then back up: [raw_pressure, area_px, nb_particles].
function pivot(): PivotImages {
    const records: PivotImageRecord[] = [[1, 2, 3], [10, 30, 1], [6, 50, 4]].map(([raw_pressure, area_px, nb_particles], i) => ({
        image_index: i, image_id: `img${i}`, raw_pressure, image_time_ms: Date.UTC(2020, 7, 6, 22, 0, i), light_on: true,
        spectrum_counts: { [area_px]: nb_particles }, blocks: [{ area_px, nb_particles, grey_mean: 10 }],
    }));
    return { columns: toPerImageColumns(records), rows: async function* () { yield* records; } };
}

function allowUser(): void {
    jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
    jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
    jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(true);
}

beforeEach(() => {
    jest.clearAllMocks();
    mockUserRepository = new MockUserRepository();
    mockPrivilegeRepository = new MockPrivilegeRepository();
    mockProjectRepository = new MockProjectRepository();
    mockSampleRepository = new MockSampleRepository();
    mockTaskRepository = new MockTaskRepository();
    regeneratePivots = new RegeneratePivots(mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockSampleRepository, mockTaskRepository);
    // Defaults: a task that is never cancelled, returned without its log file path
    jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValue();
    jest.spyOn(mockTaskRepository, "toPublicTask").mockImplementation(toPublicTask);
});

describe("RegeneratePivots", () => {
    describe("before the task", () => {
        test("rejects a user who is neither admin nor member of the project", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
            jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(false);
            jest.spyOn(mockProjectRepository, "getProject");

            await expect(regeneratePivots.execute(current_user, 1, {})).rejects.toThrow("Logged user cannot regenerate pivots in this project");
            expect(mockProjectRepository.getProject).toBeCalledTimes(0);
        });

        test("rejects an unknown project", async () => {
            allowUser();
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(null);

            await expect(regeneratePivots.execute(current_user, 1, {})).rejects.toThrow("Cannot find project");
        });

        test("rejects a non-UVP5 project before listing its samples", async () => {
            allowUser();
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue({ ...projectResponseModel, instrument_model: "UVP6HF" });
            jest.spyOn(mockSampleRepository, "standardGetSamples");

            await expect(regeneratePivots.execute(current_user, 1, {})).rejects.toThrow("Pivots only exist for UVP5 projects");
            expect(mockSampleRepository.standardGetSamples).toBeCalledTimes(0);
        });

        test("rejects sample names that are not in the project, without creating a task", async () => {
            allowUser();
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(projectResponseModel);
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockResolvedValue({ items: [sampleModel_1], total: 1 });
            jest.spyOn(mockTaskRepository, "createTask");

            await expect(regeneratePivots.execute(current_user, 1, { sample_names: ["perle3_001", "ghost"] })).rejects.toThrow("Samples not found in this project: ghost");
            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
        });

        test("rejects a project without samples", async () => {
            allowUser();
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(projectResponseModel);
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockResolvedValue({ items: [], total: 0 });

            await expect(regeneratePivots.execute(current_user, 1, {})).rejects.toThrow("No samples in this project");
        });

        test("creates a REGENERATE_PIVOT task and returns it", async () => {
            allowUser();
            jest.spyOn(mockProjectRepository, "getProject").mockResolvedValue(projectResponseModel);
            jest.spyOn(mockSampleRepository, "standardGetSamples").mockResolvedValue({ items: [sampleModel_1], total: 1 });
            jest.spyOn(mockTaskRepository, "createTask").mockResolvedValue(TaskResponseModel_1.task_id);
            jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(TaskResponseModel_1);
            const start = jest.spyOn(regeneratePivots as any, "startRegeneratePivotsTask").mockResolvedValue(undefined);

            const task = await regeneratePivots.execute(current_user, 1, { force: true });

            expect(task).toEqual(toPublicTask(TaskResponseModel_1));
            expect(mockTaskRepository.createTask).toBeCalledWith(expect.objectContaining({
                task_type: TaskType.Regenerate_Pivot,
                task_project_id: projectResponseModel.project_id,
                task_params: { sample_names: [], force: true },
            }));
            expect(start).toBeCalledWith(TaskResponseModel_1, projectResponseModel, [sampleModel_1], true);
        });
    });

    describe("the task", () => {
        beforeEach(() => {
            jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "updateTaskProgress").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "finishTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "failedTask").mockResolvedValue();
            jest.spyOn(mockTaskRepository, "logMessage").mockResolvedValue();
            jest.spyOn(mockSampleRepository, "getPivotImages").mockImplementation(async () => pivot());
            jest.spyOn(mockSampleRepository, "updateParticleStats").mockResolvedValue(1);
        });

        const loggedMessages = () => (mockTaskRepository.logMessage as jest.Mock).mock.calls.map(([, message]) => message);

        test("recomputes the particle statistics of a rebuilt pivot only", async () => {
            jest.spyOn(mockSampleRepository, "getPivotConverterVersion")
                .mockResolvedValueOnce(UVP5_PIVOT_CONVERTER_VERSION)
                .mockResolvedValueOnce(null);
            jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockResolvedValue(report("Mooring_0N_23W_201910_850m"));

            await (regeneratePivots as any).startRegeneratePivotsTask(TaskResponseModel_1, projectResponseModel, [sampleModel_1, sampleModel_2], false);

            expect(mockSampleRepository.getPivotImages).toBeCalledTimes(1);
            expect(mockSampleRepository.getPivotImages).toBeCalledWith(projectResponseModel.project_id, sampleModel_2.sample_name, projectResponseModel.instrument_model);
            // sampleModel_2 is a time series: the descent filter never applies, both pairs are equal.
            expect(mockSampleRepository.updateParticleStats).toBeCalledTimes(1);
            expect(mockSampleRepository.updateParticleStats).toBeCalledWith(sampleModel_2.sample_id, {
                nb_particles: 8, particle_min_area_px: 2, particle_max_area_px: 50,
                nb_particles_descent_filter: 8, particle_min_area_px_descent_filter: 2, particle_max_area_px_descent_filter: 50,
            });
            expect((mockSampleRepository.updateParticleStats as jest.Mock).mock.invocationCallOrder[0]).toBeGreaterThan((mockSampleRepository.generateUvp5Pivot as jest.Mock).mock.invocationCallOrder[0]);
            expect(loggedMessages()).toEqual(["Particle statistics : Mooring_0N_23W_201910_850m: 8 particle(s) counted, areas from 2 to 50 px"]);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
        });

        test("the statistics of a depth profile are stored without and with the descent filter", async () => {
            jest.spyOn(mockSampleRepository, "getPivotConverterVersion").mockResolvedValue(null);
            jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockResolvedValue(report("perle3_001"));

            await (regeneratePivots as any).startRegeneratePivotsTask(TaskResponseModel_1, projectResponseModel, [sampleModel_1], false);

            expect(mockSampleRepository.updateParticleStats).toBeCalledWith(sampleModel_1.sample_id, {
                nb_particles: 8, particle_min_area_px: 2, particle_max_area_px: 50,
                nb_particles_descent_filter: 4, particle_min_area_px_descent_filter: 2, particle_max_area_px_descent_filter: 30,
            });
        });

        test("statistics that cannot be computed are a warning: the previous ones are kept and the task goes on", async () => {
            jest.spyOn(mockSampleRepository, "getPivotConverterVersion").mockResolvedValue(null);
            jest.spyOn(mockSampleRepository, "generateUvp5Pivot")
                .mockResolvedValueOnce(report("perle3_001"))
                .mockResolvedValueOnce(report("Mooring_0N_23W_201910_850m"));
            jest.spyOn(mockSampleRepository, "getPivotImages")
                .mockRejectedValueOnce(new Error("Cannot read the particle file of sample perle3_001 (no such file)"))
                .mockImplementationOnce(async () => pivot());

            await (regeneratePivots as any).startRegeneratePivotsTask(TaskResponseModel_1, projectResponseModel, [sampleModel_1, sampleModel_2], false);

            expect(loggedMessages()).toContain("Particle statistics : perle3_001 : WARNING particle statistics not updated, the previous ones are kept (Cannot read the particle file of sample perle3_001 (no such file))");
            expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(2);
            expect(mockSampleRepository.updateParticleStats).toBeCalledTimes(1);
            expect(mockSampleRepository.updateParticleStats).toBeCalledWith(sampleModel_2.sample_id, expect.objectContaining({ nb_particles: 8 }));
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
        });

        test("keeps a pivot already at the current converter version and builds the missing one", async () => {
            jest.spyOn(mockSampleRepository, "getPivotConverterVersion")
                .mockResolvedValueOnce(UVP5_PIVOT_CONVERTER_VERSION)
                .mockResolvedValueOnce(null);
            jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockResolvedValue(report("Mooring_0N_23W_201910_850m"));

            await (regeneratePivots as any).startRegeneratePivotsTask(TaskResponseModel_1, projectResponseModel, [sampleModel_1, sampleModel_2], false);

            expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(1);
            expect(mockSampleRepository.generateUvp5Pivot).toBeCalledWith(projectResponseModel.project_id, sampleModel_2, projectResponseModel.instrument_model, projectResponseModel.root_folder_path);
            expect(mockTaskRepository.updateTaskProgress).toBeCalledWith({ task_id: TaskResponseModel_1.task_id }, 50, `perle3_001: pivot already at converter version ${UVP5_PIVOT_CONVERTER_VERSION}, kept`);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
            expect(mockTaskRepository.failedTask).toBeCalledTimes(0);
        });

        test("a cancellation stops before the next sample, the pivots already rebuilt are kept", async () => {
            const cancelled = new Error(TASK_CANCELLED_MESSAGE);
            jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValueOnce().mockRejectedValue(cancelled);
            jest.spyOn(mockSampleRepository, "getPivotConverterVersion").mockResolvedValue(null);
            jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockResolvedValue(report("perle3_001"));

            await (regeneratePivots as any).startRegeneratePivotsTask(TaskResponseModel_1, projectResponseModel, [sampleModel_1, sampleModel_2], false);

            expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(1);
            expect(mockSampleRepository.generateUvp5Pivot).toBeCalledWith(projectResponseModel.project_id, sampleModel_1, projectResponseModel.instrument_model, projectResponseModel.root_folder_path);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
            expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id, cancelled);
        });

        test("rebuilds an up-to-date pivot when forced", async () => {
            jest.spyOn(mockSampleRepository, "getPivotConverterVersion").mockResolvedValue(UVP5_PIVOT_CONVERTER_VERSION);
            jest.spyOn(mockSampleRepository, "generateUvp5Pivot").mockResolvedValue(report("perle3_001"));

            await (regeneratePivots as any).startRegeneratePivotsTask(TaskResponseModel_1, projectResponseModel, [sampleModel_1], true);

            expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(1);
            expect(mockTaskRepository.finishTask).toBeCalledTimes(1);
        });

        test("goes on after a failing sample, then fails the task listing every error", async () => {
            jest.spyOn(mockSampleRepository, "getPivotConverterVersion").mockResolvedValue(null);
            jest.spyOn(mockSampleRepository, "generateUvp5Pivot")
                .mockRejectedValueOnce(new Error("Cannot build the UVP5 pivot of sample perle3_001: boom"))
                .mockResolvedValueOnce(report("Mooring_0N_23W_201910_850m"));

            await (regeneratePivots as any).startRegeneratePivotsTask(TaskResponseModel_1, projectResponseModel, [sampleModel_1, sampleModel_2], false);

            expect(mockSampleRepository.generateUvp5Pivot).toBeCalledTimes(2);
            // Only the pivot that was rebuilt gets new statistics.
            expect(mockSampleRepository.updateParticleStats).toBeCalledTimes(1);
            expect(mockSampleRepository.updateParticleStats).toBeCalledWith(sampleModel_2.sample_id, expect.any(Object));
            expect(mockTaskRepository.finishTask).toBeCalledTimes(0);
            expect(mockTaskRepository.failedTask).toBeCalledWith(TaskResponseModel_1.task_id,
                new Error("Pivot regeneration failed for 1 of 2 sample(s). Cannot build the UVP5 pivot of sample perle3_001: boom"));
        });
    });
});
