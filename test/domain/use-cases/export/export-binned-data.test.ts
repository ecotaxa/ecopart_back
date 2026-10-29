import path from "path";
import fs from "fs";
import os from "os";
import yauzl from "yauzl";

import { MockUserRepository, MockEcotaxaAccountRepository } from "../../../mocks/user-mock";
import { MockPrivilegeRepository } from "../../../mocks/privilege-mock";
import { MockProjectRepository } from "../../../mocks/project-mock";
import { MockSampleRepository } from "../../../mocks/sample-mock";
import { MockTaskRepository } from "../../../mocks/task-mock";
import { MockInstrumentModelRepository } from "../../../mocks/instrumentModel-mock";

import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { PublicSampleModel } from "../../../../src/domain/entities/sample";
import { ProjectResponseModel } from "../../../../src/domain/entities/project";
import { TaskResponseModel, TaskType } from "../../../../src/domain/entities/task";
import { PivotImageRecord } from "../../../../src/domain/entities/binned-export";
import { PivotImages } from "../../../../src/domain/interfaces/repositories/sample-repository";
import { ExportBinnedData } from "../../../../src/domain/use-cases/export/export-binned-data";
import { ExportBinnedDataRequestModel } from "../../../../src/domain/interfaces/use-cases/export/export-binned-data";
import { TASK_CANCELLED_MESSAGE } from "../../../../src/domain/constants/task";

import { sampleModel_1 } from "../../../entities/sample";
import { private_projectResponseModel } from "../../../entities/project";
import { TaskResponseModel_1, toPublicTask } from "../../../entities/task";
import { toPerImageColumns } from "../../../../src/domain/utils/per-image-columns";
import { readParquet } from "../../../helpers/parquet";
import { zipEntryBuffer } from "../../../helpers/zip";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const TASK_ID = TaskResponseModel_1.task_id;
const current_user: UserUpdateModel = { user_id: 1 };

// sampleModel_1: UVP5HD calibration (aa 0.003, exp 1.1976) with a 2 px minimum area, so its first
// visible class is 80.6-102 µm (2 px = 93.6 µm). The fixture is PENDING, which the gate refuses.
const sample = (overrides: Partial<PublicSampleModel> = {}): PublicSampleModel =>
    ({ ...sampleModel_1, sample_id: 7, project_id: 1, visual_qc_status_label: "VALIDATED", ...overrides });

// The fixture project was created in 2024 with delays of one month each: it is `open` today.
const project = (overrides: Partial<ProjectResponseModel> = {}): ProjectResponseModel =>
    ({ ...private_projectResponseModel, project_id: 1, ...overrides });
const PRIVATE = { privacy_duration: 1200, visible_duration: 1, public_duration: 1 };
const VISIBLE = { privacy_duration: 0, visible_duration: 1200, public_duration: 1 };
const PUBLIC = { privacy_duration: 0, visible_duration: 0, public_duration: 1200 };

function pivotLine(raw_pressure: number, area_px: number, nb_particles: number, grey_mean: number, second: number): PivotImageRecord {
    return {
        image_index: second, image_id: `img${second}`, raw_pressure, image_time_ms: Date.UTC(2020, 7, 6, 22, 0, second),
        light_on: true, spectrum_counts: { [area_px]: nb_particles }, blocks: [{ area_px, nb_particles, grey_mean }],
    };
}

// A pivot read in two passes from records already in memory.
function pivotOf(records: PivotImageRecord[]): PivotImages {
    return { columns: toPerImageColumns(records), rows: async function* () { yield* records; } };
}

describe("ExportBinnedData", () => {
    let tmp_dir: string;
    let rel_storage_folder: string;
    let mockUserRepository: MockUserRepository;
    let mockPrivilegeRepository: MockPrivilegeRepository;
    let mockProjectRepository: MockProjectRepository;
    let mockSampleRepository: MockSampleRepository;
    let mockTaskRepository: MockTaskRepository;
    let useCase: ExportBinnedData;
    let task_finished: Promise<{ outcome: "finished" | "failed", detail: unknown }>;
    let log_messages: string[];
    let progress_messages: string[];

    const task_folder = () => path.join(PROJECT_ROOT, rel_storage_folder, "tasks", `${TASK_ID}`);
    const zip_path = () => path.join(task_folder(), `ecopart_export_binned_${TASK_ID}.zip`);

    beforeEach(() => {
        jest.clearAllMocks();
        tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-export-binned-"));
        rel_storage_folder = path.relative(PROJECT_ROOT, tmp_dir);
        log_messages = [];
        progress_messages = [];

        mockUserRepository = new MockUserRepository();
        mockPrivilegeRepository = new MockPrivilegeRepository();
        mockProjectRepository = new MockProjectRepository();
        mockSampleRepository = new MockSampleRepository();
        mockTaskRepository = new MockTaskRepository();
        const mockEcotaxaAccountRepository = new MockEcotaxaAccountRepository();
        const mockInstrumentModelRepository = new MockInstrumentModelRepository();
        useCase = new ExportBinnedData(mockUserRepository, mockPrivilegeRepository, mockProjectRepository, mockSampleRepository,
            mockTaskRepository, mockEcotaxaAccountRepository, mockInstrumentModelRepository, rel_storage_folder, "http://localhost:3000");

        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
        jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(false);
        jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(true);
        jest.spyOn(mockSampleRepository, "getPivotConverterVersion").mockResolvedValue("2");
        jest.spyOn(mockTaskRepository, "createTask").mockResolvedValue(TASK_ID);
        jest.spyOn(mockTaskRepository, "getOneTask").mockResolvedValue(TaskResponseModel_1 as TaskResponseModel);
        jest.spyOn(mockTaskRepository, "toPublicTask").mockImplementation(toPublicTask as any);
        jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValue();
        jest.spyOn(mockTaskRepository, "startTask").mockResolvedValue();
        jest.spyOn(mockTaskRepository, "updateTaskProgress").mockImplementation(((_t: any, _pct: number, message: string) => {
            progress_messages.push(message);
            return Promise.resolve();
        }) as any);
        jest.spyOn(mockTaskRepository, "logMessage").mockImplementation(((_p: string, message: string) => {
            log_messages.push(message);
            return Promise.resolve();
        }) as any);
        // Metadata files: only what the shared writer needs.
        jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockResolvedValue({ project_id: 1, members: [], managers: [], contact: null } as any);
        jest.spyOn(mockInstrumentModelRepository, "getOneInstrumentModel").mockResolvedValue(null as any);
        jest.spyOn(mockSampleRepository, "countSamplesPerProject").mockResolvedValue(new Map([[1, 3]]));
        jest.spyOn(mockSampleRepository, "countEcotaxaSamplesPerProject").mockResolvedValue(new Map([[1, 0]]));
        jest.spyOn(mockSampleRepository, "getPerImageRecords").mockResolvedValue(toPerImageColumns([]));
        jest.spyOn(mockSampleRepository, "getPivotImages").mockResolvedValue(pivotOf([
            pivotLine(1, 2, 10, 20, 0),      // depth 1 + 1 m project offset: bin 0-5 m
            pivotLine(12, 3, 4, 40, 1),      // depth 13 m: bin 10-15 m, the 5-10 m bin stays empty
        ]));

        task_finished = new Promise((resolve) => {
            jest.spyOn(mockTaskRepository, "finishTask").mockImplementation(((_t: any, result: any) => {
                resolve({ outcome: "finished", detail: result });
                return Promise.resolve();
            }) as any);
            jest.spyOn(mockTaskRepository, "failedTask").mockImplementation(((_id: number, error: Error) => {
                resolve({ outcome: "failed", detail: error });
                return Promise.resolve();
            }) as any);
        });
    });

    afterEach(() => {
        fs.rmSync(tmp_dir, { recursive: true, force: true });
    });

    function given(samples: PublicSampleModel[], projects: ProjectResponseModel[]) {
        const by_id = new Map(projects.map(p => [p.project_id, p]));
        jest.spyOn(mockSampleRepository, "getSamplesByIds").mockResolvedValue(samples);
        jest.spyOn(mockProjectRepository, "getProject").mockImplementation(((p: any) => Promise.resolve(by_id.get(p.project_id) ?? null)) as any);
    }

    async function exportOf(request: Partial<ExportBinnedDataRequestModel> = {}) {
        return useCase.execute(current_user, { sample_ids: [7], ...request });
    }

    describe("before the task", () => {
        // These tests are about the synchronous contract: the background work stops at its first
        // step and lands in failedTask, instead of outliving the test.
        beforeEach(() => {
            jest.spyOn(mockTaskRepository, "startTask").mockRejectedValue(new Error("background work stopped by test"));
        });

        test("an unusable user is refused before any lookup", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));
            jest.spyOn(mockSampleRepository, "getSamplesByIds");

            await expect(exportOf()).rejects.toThrow("User cannot be used");
            expect(mockSampleRepository.getSamplesByIds).toBeCalledTimes(0);
        });

        test.each([
            [{ sample_ids: [] }, "sample_ids must be a non-empty array"],
            [{ sample_ids: [0] }, "sample_ids must be positive integers"],
            [{ bin_mode: "pressure" as any }, "bin_mode must be one of: auto, depth, time"],
            [{ bin_size_m: 0.5 }, "bin_size_m must be between 1 and 100"],
            [{ bin_size_h: 30 }, "bin_size_h must be between 0.5 and 24"],
        ])("an invalid request %j is refused: %s", async (request, message) => {
            jest.spyOn(mockSampleRepository, "getSamplesByIds");

            await expect(exportOf(request)).rejects.toThrow(message);
            expect(mockSampleRepository.getSamplesByIds).toBeCalledTimes(0);
        });

        test("an unknown sample id aborts the export", async () => {
            given([sample()], [project()]);

            await expect(useCase.execute(current_user, { sample_ids: [7, 99] })).rejects.toThrow("Sample(s) not found: 99");
        });

        describe("who may export follows the project's privacy (M11)", () => {
            test.each([
                ["open", {}],
                ["public", PUBLIC],
            ])("any registered user may export from a %s project", async (_label, durations) => {
                jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(false);
                given([sample()], [project(durations)]);

                await expect(exportOf()).resolves.toBeDefined();
                expect(mockTaskRepository.createTask).toBeCalledTimes(1);
            });

            test.each([
                ["private", PRIVATE],
                ["visible", VISIBLE],
            ])("a user who is not a member cannot export from a %s project", async (_label, durations) => {
                jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(false);
                given([sample()], [project(durations)]);

                await expect(exportOf()).rejects.toThrow("Logged user cannot export binned data from project 1");
                expect(mockPrivilegeRepository.isGranted).toBeCalledWith({ user_id: 1, project_id: 1 });
                expect(mockTaskRepository.createTask).toBeCalledTimes(0);
            });

            test("a member or manager may export from a private project", async () => {
                given([sample()], [project(PRIVATE)]);

                await expect(exportOf()).resolves.toBeDefined();
            });

            test("an admin needs no privilege", async () => {
                jest.spyOn(mockUserRepository, "isAdmin").mockResolvedValue(true);
                jest.spyOn(mockPrivilegeRepository, "isGranted");
                given([sample()], [project(PRIVATE)]);

                await expect(exportOf()).resolves.toBeDefined();
                expect(mockPrivilegeRepository.isGranted).toBeCalledTimes(0);
            });

            test("authorization comes before the QC gate, which would name the samples", async () => {
                jest.spyOn(mockPrivilegeRepository, "isGranted").mockResolvedValue(false);
                given([sample({ visual_qc_status_label: "PENDING" })], [project(PRIVATE)]);

                await expect(exportOf()).rejects.toThrow("Logged user cannot export binned data from project 1");
            });
        });

        test("a sample that is not VALIDATED aborts the export unless skip_not_validated drops it", async () => {
            given([sample(), sample({ sample_id: 8, sample_name: "pending_one", visual_qc_status_label: "PENDING" })], [project()]);

            await expect(useCase.execute(current_user, { sample_ids: [7, 8] })).rejects.toThrow("Sample(s) not validated: pending_one");
            await expect(useCase.execute(current_user, { sample_ids: [7, 8], skip_not_validated: true })).resolves.toBeDefined();
        });

        test("samples without calibration are all named at once", async () => {
            given([
                sample({ sample_name: "no_aa", instrument_settings_aa: null as any }),
                sample({ sample_id: 8, sample_name: "no_volume", instrument_settings_image_volume_l: 0 }),
            ], [project()]);

            await expect(useCase.execute(current_user, { sample_ids: [7, 8] }))
                .rejects.toThrow("Sample(s) without calibration: no_aa (aa), no_volume (image volume)");
            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
        });

        test("a UVP5 sample needs its pivot, a UVP6 sample is read from its own file", async () => {
            jest.spyOn(mockSampleRepository, "getPivotConverterVersion").mockResolvedValue(null);
            given([sample()], [project()]);

            await expect(exportOf()).rejects.toThrow(`Sample(s) without pivot: ${sampleModel_1.sample_name}. Run the pivot regeneration of their project.`);

            given([sample({ instrument_settings_aa: 2300, instrument_settings_exp: 1.136 })], [project({ instrument_model: "UVP6LP" })]);
            jest.spyOn(mockSampleRepository, "getPivotConverterVersion").mockClear();
            await expect(exportOf()).resolves.toBeDefined();
            expect(mockSampleRepository.getPivotConverterVersion).toBeCalledTimes(0);
        });

        test("an instrument without per-image particle data is refused", async () => {
            given([sample()], [project({ instrument_model: "LISST" })]);

            await expect(exportOf()).rejects.toThrow(`Instrument not supported by the binned export: ${sampleModel_1.sample_name} (LISST)`);
        });

        test("an unknown table format is refused before any lookup", async () => {
            given([sample()], [project()]);

            await expect(exportOf({ format: "csv" as any })).rejects.toThrow("format must be one of: tsv, parquet");

            expect(mockSampleRepository.getSamplesByIds).toBeCalledTimes(0);
            expect(mockTaskRepository.createTask).toBeCalledTimes(0);
        });

        test("creates an EXPORT task, not tied to a project, with the binning it will apply", async () => {
            given([sample()], [project()]);

            const task = await exportOf();

            expect(task).toEqual(toPublicTask(TaskResponseModel_1));
            expect(mockTaskRepository.createTask).toBeCalledWith({
                task_type: TaskType.Export,
                task_status: "PENDING",
                task_owner_id: 1,
                task_params: { sample_ids: [7], bin_mode: "auto", bin_size_m: 5, bin_size_h: 1, skip_not_validated: false, format: "tsv" },
            });
        });
    });

    describe("the archive", () => {
        function zipEntries(zip: string): Promise<Record<string, string>> {
            return new Promise((resolve, reject) => {
                const entries: Record<string, string> = {};
                yauzl.open(zip, { lazyEntries: true }, (err, zipfile) => {
                    if (err || !zipfile) return reject(err);
                    zipfile.readEntry();
                    zipfile.on("entry", (entry) => {
                        if (/\/$/.test(entry.fileName)) return zipfile.readEntry();
                        zipfile.openReadStream(entry, (err2, stream) => {
                            if (err2 || !stream) return reject(err2);
                            let data = "";
                            stream.on("data", (chunk) => (data += chunk));
                            stream.on("end", () => { entries[entry.fileName] = data; zipfile.readEntry(); });
                        });
                    });
                    zipfile.on("end", () => resolve(entries));
                });
            });
        }
        const parseTsv = (content: string) => {
            const [header, ...lines] = content.replace(/\n$/, "").split("\n").map((line) => line.split("\t"));
            return lines.map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i]])));
        };

        test("holds the metadata, one particles.tsv row per bin and the README", async () => {
            given([sample()], [project()]);

            await exportOf();
            const outcome = await task_finished;

            expect(outcome).toEqual({ outcome: "finished", detail: `http://localhost:3000/api/tasks/${TASK_ID}/file` });
            const entries = await zipEntries(zip_path());
            expect(Object.keys(entries).sort()).toEqual(["README.md", "metadata/projects.tsv", "metadata/samples.tsv", "particles.tsv"]);
            expect(fs.existsSync(path.join(task_folder(), "binned_export"))).toBe(false);

            const rows = parseTsv(entries["particles.tsv"]);
            expect(rows.map((r) => [r.subsample_depth_start, r.subsample_depth_stop, r.subsample_nb_images])).toEqual([["0", "5", "1"], ["5", "10", "0"], ["10", "15", "1"]]);
            expect(rows[0]).toMatchObject({
                ecopart_sample_id: "7",
                subsample_water_volume: "1.12",
                nb_black_images: "NA",
                count_1px: "NA",
                count_2px: "10",
                count_80p6um_102um: "10",
                intensity_80p6um_102um: "20",
            });
            expect(Number(rows[0].concentration_80p6um_102um)).toBeCloseTo(10 / 1.12, 9);
            expect(rows[1]).toMatchObject({ subsample_water_volume: "0", count_80p6um_102um: "NA" });
            expect(rows[2]).toMatchObject({ count_102um_128um: "4", intensity_102um_128um: "40" });
            // The sample's first visible class is the first class column: nothing below 80.6 µm.
            expect(Object.keys(rows[0]).find((c) => c.startsWith("count_") && c.endsWith("um"))).toBe("count_80p6um_102um");

            expect(parseTsv(entries["metadata/samples.tsv"])[0]).toMatchObject({ ecopart_sample_id: "7" });
            expect(entries["README.md"]).toContain("# EcoPart binned export");
            expect(entries["README.md"]).toContain("depth bins of 5 m");
            expect(progress_messages.some((m) => m.includes(`${sampleModel_1.sample_name}: 3 depth bin(s) of 5 m from 2 image(s) used`))).toBe(true);
            expect(mockSampleRepository.getPivotImages).toBeCalledWith(1, sampleModel_1.sample_name, "UVP5HD");
        });

        test("format=parquet: the three tables are typed Parquet files, where NA and the empty cell are both null", async () => {
            given([sample()], [project()]);

            await exportOf({ format: "parquet" });
            const outcome = await task_finished;

            expect(outcome).toEqual({ outcome: "finished", detail: `http://localhost:3000/api/tasks/${TASK_ID}/file` });
            expect(mockTaskRepository.createTask).toBeCalledWith(expect.objectContaining({ task_params: expect.objectContaining({ format: "parquet" }) }));
            const entries = await zipEntries(zip_path());
            expect(Object.keys(entries).sort()).toEqual(["README.md", "metadata/projects.parquet", "metadata/samples.parquet", "particles.parquet"]);

            const particles = await readParquet(await zipEntryBuffer(zip_path(), "particles.parquet"));
            expect(particles.columns.slice(0, 2)).toEqual([
                { name: "ecopart_sample_id", type: "INT64", converted_type: undefined, logical_type: undefined, repetition_type: "OPTIONAL" },
                { name: "subsample_utc_date_time_start", type: "INT64", converted_type: "TIMESTAMP_MILLIS", logical_type: { type: "TIMESTAMP", isAdjustedToUTC: true, unit: "MILLIS" }, repetition_type: "OPTIONAL" },
            ]);
            expect(particles.columns.find((c) => c.name === "count_80p6um_102um")?.type).toBe("INT64");
            expect(particles.columns.find((c) => c.name === "concentration_80p6um_102um")?.type).toBe("DOUBLE");
            expect(particles.rows.map((r) => [r.subsample_depth_start, r.subsample_depth_stop, r.subsample_nb_images])).toEqual([[0, 5, BigInt(1)], [5, 10, BigInt(0)], [10, 15, BigInt(1)]]);
            expect(particles.rows[0]).toMatchObject({
                ecopart_sample_id: BigInt(7),
                subsample_utc_date_time_start: new Date(Date.UTC(2020, 7, 6, 22, 0, 0)),
                subsample_water_volume: 1.12,
                subsample_qcflag: BigInt(0),
                nb_black_images: null,
                count_1px: null,
                count_2px: BigInt(10),
                count_80p6um_102um: BigInt(10),
                intensity_80p6um_102um: 20,
                qcflag_80p6um_102um: BigInt(0),
            });
            expect(particles.rows[0].concentration_80p6um_102um).toBeCloseTo(10 / 1.12, 12);
            expect(particles.rows[1]).toMatchObject({ subsample_water_volume: 0, subsample_utc_date_time_start: null, count_80p6um_102um: null, qcflag_80p6um_102um: BigInt(0) });
            expect(particles.rows[2]).toMatchObject({ count_102um_128um: BigInt(4), intensity_102um_128um: 40 });

            const samples_table = await readParquet(await zipEntryBuffer(zip_path(), "metadata/samples.parquet"));
            expect(samples_table.rows[0]).toMatchObject({ ecopart_sample_id: BigInt(7), sample_name: sampleModel_1.sample_name });

            expect(entries["README.md"]).toContain("└── particles.parquet");
            expect(entries["README.md"]).toContain("Every table is an Apache Parquet file");
            expect(entries["README.md"]).toContain("a null cell in `count_1px`, `count_2px`, `nb_black_images` and in the size-class blocks is the `NA` of the TSV form");
            expect(entries["README.md"]).toContain("a null cell in `subsample_utc_date_time_start`, `subsample_utc_date_time_stop`, `subsample_depth_start`, `subsample_depth_stop` is the empty cell of the TSV form");
            expect(entries["README.md"]).toContain("No column can hold both kinds of absence");
            expect(entries["README.md"]).toContain("## `particles.parquet`");
            expect(entries["README.md"]).toContain("| `subsample_water_volume` | double |");
            expect(entries["README.md"]).not.toContain(".tsv");
            expect(log_messages.some((m) => m.includes("particles.tsv"))).toBe(false);
        });

        test("time bins when the request forces them", async () => {
            given([sample()], [project()]);

            await exportOf({ bin_mode: "time", bin_size_h: 0.5 });
            await task_finished;

            const rows = parseTsv((await zipEntries(zip_path()))["particles.tsv"]);
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                subsample_utc_date_time_start: "2020-08-06T22:00:00.000Z",
                subsample_utc_date_time_stop: "2020-08-06T22:30:00.000Z",
                subsample_depth_start: "7.5",
                subsample_depth_stop: "",
                subsample_nb_images: "2",
            });
        });

        test("a particle file that cannot be read fails the task and leaves no archive", async () => {
            jest.spyOn(mockSampleRepository, "getPivotImages").mockRejectedValue(new Error("Cannot read the particle file of sample perle3_001 (no such file)"));
            given([sample()], [project()]);

            await exportOf();
            const outcome = await task_finished;

            expect(outcome.outcome).toBe("failed");
            expect((outcome.detail as Error).message).toContain("Cannot read the particle file of sample perle3_001");
            expect(fs.existsSync(zip_path())).toBe(false);
            expect(fs.existsSync(path.join(task_folder(), "binned_export"))).toBe(false);
            expect(log_messages).toContain("Cleanup after failure : removed the working folder binned_export/ of the task folder");
        });

        test("a cancellation stops the export and leaves no archive", async () => {
            const cancelled = new Error(TASK_CANCELLED_MESSAGE);
            jest.spyOn(mockTaskRepository, "throwIfCancelled").mockResolvedValueOnce().mockRejectedValue(cancelled);
            given([sample()], [project()]);

            await exportOf();

            expect(await task_finished).toEqual({ outcome: "failed", detail: cancelled });
            expect(fs.existsSync(zip_path())).toBe(false);
            expect(log_messages).toContain("Cleanup after cancellation : removed the working folder binned_export/ of the task folder");
        });

        test("UVP5 and UVP6 samples share one table: the union of their classes, NA where a sample cannot see one", async () => {
            const uvp6 = sample({ sample_id: 9, project_id: 2, sample_name: "uvp6_one", instrument_settings_aa: 2300, instrument_settings_exp: 1.136, instrument_settings_particule_minimum_area_pixels: undefined });
            jest.spyOn(mockSampleRepository, "getPivotImages").mockImplementation(((_project_id: number, sample_name: string) => Promise.resolve(pivotOf(
                sample_name === "uvp6_one"
                    ? [pivotLine(2, 1, 50, 30, 0), { ...pivotLine(3, 1, 7, 10, 1), light_on: false }]
                    : [pivotLine(1, 2, 10, 20, 0)]))) as any);
            given([uvp6, sample()], [project(), project({ project_id: 2, instrument_model: "UVP6LP" })]);

            await useCase.execute(current_user, { sample_ids: [9, 7] });
            await task_finished;

            const rows = parseTsv((await zipEntries(zip_path()))["particles.tsv"]);
            // Ordered by project then sample, like samples.tsv.
            expect(rows.map((r) => r.ecopart_sample_id)).toEqual(["7", "9"]);
            // The UVP6 sees 50.8 µm, the UVP5 (2 px minimum) only from 80.6 µm.
            expect(Object.keys(rows[0]).find((c) => c.startsWith("count_") && c.endsWith("um"))).toBe("count_50p8um_64um");
            expect(rows[0]).toMatchObject({ count_50p8um_64um: "NA", count_80p6um_102um: "10", nb_black_images: "NA" });
            expect(rows[1]).toMatchObject({ count_50p8um_64um: "50", count_1px: "50", nb_black_images: "1", count_80p6um_102um: "0" });
        });

        test("logs a sample left without any row, and the particles below its minimum area", async () => {
            const no_pressure = sample({ sample_id: 8, sample_name: "no_pressure" });
            jest.spyOn(mockSampleRepository, "getPivotImages").mockImplementation(((_project_id: number, sample_name: string) => Promise.resolve(pivotOf(
                sample_name === "no_pressure"
                    ? [{ ...pivotLine(1, 2, 10, 20, 0), raw_pressure: null }]
                    : [{ ...pivotLine(1, 2, 10, 20, 0), blocks: [{ area_px: 1, nb_particles: 6, grey_mean: 10 }, { area_px: 2, nb_particles: 10, grey_mean: 20 }] }]))) as any);
            given([sample(), no_pressure], [project()]);

            await useCase.execute(current_user, { sample_ids: [7, 8] });
            expect((await task_finished).outcome).toBe("finished");

            expect(log_messages).toContain("no_pressure: none of its images has a pressure, the sample has no row in particles.tsv");
            expect(log_messages).toContain(`${sampleModel_1.sample_name}: 6 particle(s) smaller than the minimum area of 2 px are left out of the counts`);
        });

        test("the task log states the request, each sample binned, the particle table and the archive", async () => {
            jest.spyOn(mockSampleRepository, "getPivotImages").mockImplementation(((_project_id: number, sample_name: string) => Promise.resolve(pivotOf(
                sample_name === "no_pressure"
                    ? [{ ...pivotLine(1, 2, 10, 20, 0), raw_pressure: null }]
                    : [pivotLine(1, 2, 10, 20, 0), pivotLine(12, 2, 4, 20, 1)]))) as any);
            given([sample(), sample({ sample_id: 8, sample_name: "no_pressure" })], [project({ project_title: "Perle 3", instrument_model: "UVP5HD" })]);

            await useCase.execute(current_user, { sample_ids: [7, 8] });
            expect((await task_finished).outcome).toBe("finished");

            expect(log_messages).toContain("Request: 2 sample(s) from 1 project(s), bin_mode auto, depth bins of 5 m, time bins of 1 h, format tsv");
            expect(log_messages).toContain("Request: project 1 'Perle 3' (UVP5HD): 2 sample(s)");
            expect(log_messages).toContain("Particles: 26 size class(es) exported, from 80p6um_102um to 26000um_inf");
            // Pressures 1 and 12 on 5 m bins: 0-5 m and 10-15 m hold an image, 5-10 m is crossed without one
            expect(log_messages).toContain(`Particles: ${sampleModel_1.sample_name} (depth axis, Depth sample): 2 of 2 image(s) of the particle file used, 3 row(s) from 0 m to 15 m, 1 of them without imaged volume, 2.24 L imaged`);
            expect(log_messages).toContain("Particles: no_pressure (depth axis, Depth sample): 0 of 1 image(s) of the particle file used");
            expect(log_messages.some(m => /^Particles: particles\.tsv written, 3 row\(s\) for 2 sample\(s\), [\d.]+ (B|kB)$/.test(m))).toBe(true);
            expect(log_messages.some(m => new RegExp(`^Archive: ecopart_export_binned_${TASK_ID}\\.zip written, [\\d.]+ (B|kB)$`).test(m))).toBe(true);
            expect(log_messages).toContain(`Exported at: ${path.relative(PROJECT_ROOT, zip_path())}`);
            expect(log_messages.some(m => m.includes(PROJECT_ROOT))).toBe(false);
            // The size classes are announced with the particle step, after the metadata
            expect(log_messages.findIndex(m => m.startsWith("Particles: 26 size class"))).toBeGreaterThan(log_messages.findIndex(m => m.startsWith("Metadata: samples.tsv")));
        });

        test("the samples dropped by skip_not_validated are named in the task log", async () => {
            given([sample(), sample({ sample_id: 8, sample_name: "pending_one", visual_qc_status_label: "PENDING" })], [project()]);

            await useCase.execute(current_user, { sample_ids: [7, 8], skip_not_validated: true });
            await task_finished;

            expect(log_messages).toContain("QC: 1 sample(s) excluded from this export because they are not VALIDATED: pending_one (PENDING)");
        });
    });
});
