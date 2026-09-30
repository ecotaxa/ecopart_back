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
import { TaskResponseModel } from "../../../../src/domain/entities/task";
import { ExportRawData } from "../../../../src/domain/use-cases/export/export-raw-data";
import { RawExportType } from "../../../../src/domain/interfaces/use-cases/export/export-raw-data";

import { sampleModel_1, sampleModel_2 } from "../../../entities/sample";
import { private_projectResponseModel } from "../../../entities/project";
import { TaskResponseModel_1 } from "../../../entities/task";

/*
 * Tests of the *background* half of the use case: the archive `runExport` actually produces.
 * `execute` is fire-and-forget, so each test waits on the task's terminal call (finishTask /
 * failedTask) before unzipping the result and asserting on its contents.
 *
 * `DATA_STORAGE_FOLDER` is resolved relative to the repository root by the use case, so the temp
 * folder is passed as a path relative to that root (same trick as the end-to-end tests).
 */

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const TASK_ID = TaskResponseModel_1.task_id;

const current_user: UserUpdateModel = { user_id: 1 };

const validated = (sample: PublicSampleModel, overrides: Partial<PublicSampleModel> = {}): PublicSampleModel =>
    ({ ...sample, visual_qc_status_label: "VALIDATED", ...overrides });

function project(overrides: Partial<ProjectResponseModel> = {}): ProjectResponseModel {
    return { ...private_projectResponseModel, ...overrides };
}

// ─── zip helpers ───

function zipEntries(zip_path: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const entries: string[] = [];
        yauzl.open(zip_path, { lazyEntries: true }, (err, zipfile) => {
            if (err || !zipfile) return reject(err || new Error("Failed to open zip"));
            zipfile.readEntry();
            zipfile.on("entry", (entry) => {
                if (!/\/$/.test(entry.fileName)) entries.push(entry.fileName);
                zipfile.readEntry();
            });
            zipfile.on("end", () => resolve(entries));
            zipfile.on("error", reject);
        });
    });
}

function zipEntryContent(zip_path: string, entry_name: string): Promise<string> {
    return new Promise((resolve, reject) => {
        yauzl.open(zip_path, { lazyEntries: true }, (err, zipfile) => {
            if (err || !zipfile) return reject(err || new Error("Failed to open zip"));
            zipfile.readEntry();
            zipfile.on("entry", (entry) => {
                if (entry.fileName !== entry_name) return zipfile.readEntry();
                zipfile.openReadStream(entry, (err2, stream) => {
                    if (err2 || !stream) return reject(err2 || new Error("Failed to read entry"));
                    let data = "";
                    stream.on("data", (chunk) => (data += chunk));
                    stream.on("end", () => resolve(data));
                });
            });
            zipfile.on("end", () => reject(new Error(`Entry not found in archive: ${entry_name}`)));
            zipfile.on("error", reject);
        });
    });
}

// Parse a TSV into { headers, rows: Record<column, cell>[] } keeping the raw cell arrays too, so
// tests can assert both on values and on the column/cell alignment.
function parseTsv(content: string): { headers: string[], cells: string[][], rows: Record<string, string>[] } {
    const lines = content.replace(/\n$/, "").split("\n");
    const headers = lines[0].split("\t");
    const cells = lines.slice(1).map(line => line.split("\t"));
    const rows = cells.map(cell_list => Object.fromEntries(headers.map((h, i) => [h, cell_list[i]])));
    return { headers, cells, rows };
}

describe("ExportRawData — produced archive", () => {
    let tmp_dir: string;
    let rel_storage_folder: string;
    let mockUserRepository: MockUserRepository;
    let mockPrivilegeRepository: MockPrivilegeRepository;
    let mockProjectRepository: MockProjectRepository;
    let mockSampleRepository: MockSampleRepository;
    let mockTaskRepository: MockTaskRepository;
    let mockEcotaxaAccountRepository: MockEcotaxaAccountRepository;
    let mockInstrumentModelRepository: MockInstrumentModelRepository;
    let exportRawDataUseCase: ExportRawData;
    let task_finished: Promise<{ outcome: "finished" | "failed", detail: unknown }>;
    let log_messages: string[];

    const zip_path = () => path.join(PROJECT_ROOT, rel_storage_folder, "tasks", `${TASK_ID}`, `ecopart_export_raw_${TASK_ID}.zip`);

    beforeEach(() => {
        jest.clearAllMocks();
        tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-export-raw-"));
        rel_storage_folder = path.relative(PROJECT_ROOT, tmp_dir);
        log_messages = [];

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
            rel_storage_folder,
            "http://localhost:3000",
        );

        // ── common happy-path stubs ──
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockImplementation(() => Promise.resolve());
        jest.spyOn(mockUserRepository, "isAdmin").mockImplementation(() => Promise.resolve(true));
        jest.spyOn(mockTaskRepository, "createTask").mockImplementation(() => Promise.resolve(TASK_ID));
        jest.spyOn(mockTaskRepository, "getOneTask").mockImplementation(() => Promise.resolve(TaskResponseModel_1 as TaskResponseModel));
        jest.spyOn(mockTaskRepository, "startTask").mockImplementation(() => Promise.resolve());
        jest.spyOn(mockTaskRepository, "updateTaskProgress").mockImplementation(() => Promise.resolve());
        // The hand-written mocks declare these methods without parameters, hence the `as any` on
        // every implementation that needs to inspect its arguments.
        jest.spyOn(mockTaskRepository, "logMessage").mockImplementation(((_p: string, message: string) => {
            log_messages.push(message);
            return Promise.resolve();
        }) as any);
        jest.spyOn(mockPrivilegeRepository, "getPublicPrivileges").mockImplementation(() => Promise.resolve({
            project_id: 1,
            members: [{ user_id: 2, user_name: "Jane Doe", email: "jane@example.org" }],
            managers: [{ user_id: 1, user_name: "John Smith", email: "john@example.org" }],
            contact: { user_id: 1, user_name: "John Smith", email: "john@example.org" },
        } as any));
        jest.spyOn(mockEcotaxaAccountRepository, "getOneEcoTaxaInstance").mockImplementation(() => Promise.resolve({
            ecotaxa_instance_id: 1, ecotaxa_instance_name: "dev", ecotaxa_instance_url: "https://ecotaxa.example.org",
            ecotaxa_instance_creation_utc_date_time: "2024-01-01 00:00:00",
        } as any));
        jest.spyOn(mockInstrumentModelRepository, "getOneInstrumentModel").mockImplementation(() => Promise.resolve({
            instrument_model_id: 1, instrument_model_name: "UVP5HD", bodc_url: "https://vocab.example.org/TOOL1577/",
        } as any));
        jest.spyOn(mockSampleRepository, "countSamplesPerProject").mockImplementation(() => Promise.resolve(new Map([[1, 10]])));
        jest.spyOn(mockSampleRepository, "countEcotaxaSamplesPerProject").mockImplementation(() => Promise.resolve(new Map([[1, 4]])));
        // Default EcoTaxa stub: writes the file the real repository would download. Tests that care
        // about the call itself override it.
        jest.spyOn(mockEcotaxaAccountRepository, "exportObjectSetGeneral").mockImplementation(
            ((_p: any, _names: string[], _exclude: boolean, dest: string) => {
                fs.writeFileSync(dest, "ecotaxa-zip-payload");
                return Promise.resolve();
            }) as any);

        // The task's terminal calls double as the "background work is over" signal.
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

    async function runExport(samples: PublicSampleModel[], export_types: RawExportType[], projects: ProjectResponseModel[], extra: Record<string, unknown> = {}) {
        const by_id = new Map(projects.map(p => [p.project_id, p]));
        jest.spyOn(mockSampleRepository, "getSamplesByIds").mockImplementation(() => Promise.resolve(samples));
        jest.spyOn(mockProjectRepository, "getProject").mockImplementation(((p: any) => Promise.resolve(by_id.get(p.project_id) ?? null)) as any);

        await exportRawDataUseCase.execute(current_user, { sample_ids: samples.map(s => s.sample_id), export_types, ecotaxa_exclude_not_living: false, ...extra });
        return task_finished;
    }

    describe("metadata step", () => {
        const samples = [
            validated(sampleModel_1, { sample_id: 7, project_id: 1 }),
            validated(sampleModel_2, { sample_id: 3, project_id: 1 }),
        ];

        test("writes both TSVs plus the generated README, and finishes the task with the download link", async () => {
            const outcome = await runExport(samples, ["metadata"], [project({ project_id: 1 })]);

            expect(outcome).toEqual({ outcome: "finished", detail: `http://localhost:3000/api/tasks/${TASK_ID}/file` });

            const entries = await zipEntries(zip_path());
            expect(entries).toContain("metadata/projects.tsv");
            expect(entries).toContain("metadata/samples.tsv");
            expect(entries).toContain("README.md");
            // Nothing else: an export of `metadata` alone must not create the other folders.
            expect(entries.filter(e => e.startsWith("lpm/") || e.startsWith("ctd/") || e.startsWith("ecotaxa/"))).toEqual([]);
        });

        test("every row has exactly one cell per header column, and headers are unique", async () => {
            await runExport(samples, ["metadata"], [project({ project_id: 1 })]);

            for (const file of ["metadata/projects.tsv", "metadata/samples.tsv"]) {
                const { headers, cells } = parseTsv(await zipEntryContent(zip_path(), file));
                expect(new Set(headers).size).toBe(headers.length);
                expect(cells.length).toBeGreaterThan(0);
                for (const row of cells) {
                    expect(row.length).toBe(headers.length);
                }
            }
        });

        test("sample rows are ordered by (project_id, sample_id), not by input order", async () => {
            const cross_project = [
                validated(sampleModel_1, { sample_id: 9, project_id: 2 }),
                validated(sampleModel_2, { sample_id: 4, project_id: 1 }),
                validated(sampleModel_1, { sample_id: 2, project_id: 2 }),
            ];

            await runExport(cross_project, ["metadata"], [project({ project_id: 1 }), project({ project_id: 2 })]);

            const { rows } = parseTsv(await zipEntryContent(zip_path(), "metadata/samples.tsv"));
            expect(rows.map(r => [r.ecopart_project_id, r.ecopart_sample_id])).toEqual([
                ["1", "4"], ["2", "2"], ["2", "9"],
            ]);
        });

        test("tabs and newlines inside a cell are collapsed so the row stays parseable", async () => {
            const messy = [validated(sampleModel_1, { sample_id: 1, project_id: 1, comment: "line one\nline\ttwo\r\nend" })];

            await runExport(messy, ["metadata"], [project({ project_id: 1 })]);

            const content = await zipEntryContent(zip_path(), "metadata/samples.tsv");
            const { headers, cells, rows } = parseTsv(content);
            expect(cells).toHaveLength(1);
            expect(cells[0].length).toBe(headers.length);
            expect(rows[0].sample_comment).toBe("line one line two end");
        });

        test("timestamps are ISO 8601 UTC and booleans are true/false", async () => {
            await runExport([validated(sampleModel_1, { sample_id: 1, project_id: 1, ecotaxa_sample_imported: true })],
                ["metadata"], [project({ project_id: 1 })]);

            const { rows } = parseTsv(await zipEntryContent(zip_path(), "metadata/samples.tsv"));
            expect(rows[0].sample_import_utc_date_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            expect(rows[0].ecotaxa_sample_imported).toBe("true");

            const { rows: project_rows } = parseTsv(await zipEntryContent(zip_path(), "metadata/projects.tsv"));
            expect(project_rows[0].project_creation_utc_date_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            expect(project_rows[0].project_export_utc_date_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        test("per-project counters reflect the DB totals and what this export really contains", async () => {
            const with_ecotaxa = [
                validated(sampleModel_1, { sample_id: 1, project_id: 1, ecotaxa_sample_imported: true }),
                validated(sampleModel_2, { sample_id: 2, project_id: 1, ecotaxa_sample_imported: false }),
            ];

            await runExport(with_ecotaxa, ["metadata", "ecotaxa"], [project({ project_id: 1, ecotaxa_project_id: 55 })]);

            const { rows } = parseTsv(await zipEntryContent(zip_path(), "metadata/projects.tsv"));
            expect(rows[0].project_total_samples).toBe("10");            // DB total
            expect(rows[0].project_total_samples_exported).toBe("2");    // in this basket
            expect(rows[0].project_total_ecotaxa_samples).toBe("4");     // DB total
            // Only the sample actually shipped in the EcoTaxa section counts.
            expect(rows[0].project_total_ecotaxa_samples_exported).toBe("1");
        });

        test("the ecotaxa counter stays at 0 when the ecotaxa step was not requested", async () => {
            const imported = [validated(sampleModel_1, { sample_id: 1, project_id: 1, ecotaxa_sample_imported: true })];

            await runExport(imported, ["metadata"], [project({ project_id: 1, ecotaxa_project_id: 55 })]);

            const { rows } = parseTsv(await zipEntryContent(zip_path(), "metadata/projects.tsv"));
            expect(rows[0].project_total_ecotaxa_samples_exported).toBe("0");
            expect(rows[0].project_total_ecotaxa_samples).toBe("4");
        });

        test("managers and members are rendered as 'name <email>' lists", async () => {
            await runExport([validated(sampleModel_1, { sample_id: 1, project_id: 1 })], ["metadata"], [project({ project_id: 1 })]);

            const { rows } = parseTsv(await zipEntryContent(zip_path(), "metadata/projects.tsv"));
            expect(rows[0].project_managers).toBe("John Smith <john@example.org>");
            expect(rows[0].project_members).toBe("Jane Doe <jane@example.org>");
        });
    });

    describe("artifact steps (lpm / images / instrument_config)", () => {
        // One fake artifact per category, so a test can assert that asking for one category never
        // drags in another one's files.
        function seedArtifacts(sample_name: string): Record<string, string> {
            const source_dir = path.join(tmp_dir, "source");
            fs.mkdirSync(source_dir, { recursive: true });
            const files: Record<string, string> = {
                lpm: path.join(source_dir, `${sample_name}_work.zip`),
                images: path.join(source_dir, `${sample_name}_Images.zip`),
                instrument_config: path.join(source_dir, `${sample_name}_meta_conf.zip`),
            };
            fs.writeFileSync(files.lpm, "work-payload");
            fs.writeFileSync(files.images, "images-payload");
            fs.writeFileSync(files.instrument_config, "meta-conf-payload");
            // Stands in for the repository's per-category resolution.
            jest.spyOn(mockSampleRepository, "listRawFilesForSample").mockImplementation(
                ((_model: string, _pid: number, _name: string, category: string) => Promise.resolve([files[category]])) as any);
            return files;
        }

        test("each category lands in its own folder — asking for lpm ships the particle data only", async () => {
            seedArtifacts("perle3_001");

            await runExport([validated(sampleModel_1, { sample_id: 1, project_id: 1, sample_name: "perle3_001" })],
                ["lpm"], [project({ project_id: 1 })]);

            const entries = await zipEntries(zip_path());
            expect(entries).toContain("lpm/1/perle3_001/perle3_001_work.zip");
            expect(await zipEntryContent(zip_path(), "lpm/1/perle3_001/perle3_001_work.zip")).toBe("work-payload");
            // The vignettes and the instrument configuration are other export types now.
            expect(entries.some(e => e.includes("_Images.zip"))).toBe(false);
            expect(entries.some(e => e.includes("_meta_conf.zip"))).toBe(false);
        });

        test("images and instrument_config each produce their own folder", async () => {
            seedArtifacts("perle3_001");

            await runExport([validated(sampleModel_1, { sample_id: 1, project_id: 1, sample_name: "perle3_001" })],
                ["images", "instrument_config"], [project({ project_id: 1 })]);

            const entries = await zipEntries(zip_path());
            expect(entries).toContain("images/1/perle3_001/perle3_001_Images.zip");
            expect(entries).toContain("instrument_config/1/perle3_001/perle3_001_meta_conf.zip");
            expect(entries.some(e => e.startsWith("lpm/"))).toBe(false);
            expect(await zipEntryContent(zip_path(), "images/1/perle3_001/perle3_001_Images.zip")).toBe("images-payload");
        });

        test("a missing particle artifact is a warning; a missing image/config archive is not", async () => {
            jest.spyOn(mockSampleRepository, "listRawFilesForSample").mockImplementation(() => Promise.resolve([]));

            const outcome = await runExport([validated(sampleModel_1, { sample_id: 1, project_id: 1, sample_name: "perle3_001" })],
                ["lpm", "images", "instrument_config"], [project({ project_id: 1 })]);

            expect(outcome.outcome).toBe("finished");
            expect(log_messages.some(m => m.includes("LPM: no raw files found for sample 'perle3_001'"))).toBe(true);
            expect(log_messages.some(m => m.includes("Images: nothing to export for sample 'perle3_001'"))).toBe(true);
            expect(log_messages.some(m => m.includes("Instrument config: nothing to export for sample 'perle3_001'"))).toBe(true);
        });

        test("the repository is queried once per sample and per requested category", async () => {
            seedArtifacts("perle3_001");

            await runExport([
                validated(sampleModel_1, { sample_id: 1, project_id: 1, sample_name: "perle3_001" }),
                validated(sampleModel_2, { sample_id: 2, project_id: 1, sample_name: "perle3_002" }),
            ], ["lpm", "images"], [project({ project_id: 1 })]);

            const calls = (mockSampleRepository.listRawFilesForSample as jest.Mock).mock.calls;
            expect(calls).toHaveLength(4);
            expect(calls.map(c => [c[2], c[3]])).toEqual([
                ["perle3_001", "lpm"], ["perle3_002", "lpm"],
                ["perle3_001", "images"], ["perle3_002", "images"],
            ]);
        });
    });

    describe("ctd step", () => {
        test("copies the CTD file as ctd/<project_id>/<sample_name>.<extension>", async () => {
            const ctd_file = path.join(tmp_dir, "source_ctd.ctd");
            fs.mkdirSync(path.dirname(ctd_file), { recursive: true });
            fs.writeFileSync(ctd_file, "ctd-payload");
            jest.spyOn(mockSampleRepository, "getCTDFileAbsolutePath").mockImplementation(() => ctd_file);

            await runExport([validated(sampleModel_1, { sample_id: 1, project_id: 1, sample_name: "perle3_001", ctd_imported: true, ctd_file_extension: "ctd" })],
                ["ctd"], [project({ project_id: 1 })]);

            expect(await zipEntryContent(zip_path(), "ctd/1/perle3_001.ctd")).toBe("ctd-payload");
        });

        test("samples without a CTD import, and files missing on disk, are logged and skipped", async () => {
            jest.spyOn(mockSampleRepository, "getCTDFileAbsolutePath").mockImplementation(() => path.join(tmp_dir, "does_not_exist.ctd"));

            const outcome = await runExport([
                validated(sampleModel_1, { sample_id: 1, project_id: 1, sample_name: "no_ctd", ctd_imported: false }),
                validated(sampleModel_2, { sample_id: 2, project_id: 1, sample_name: "ctd_gone", ctd_imported: true, ctd_file_extension: "ctd" }),
            ], ["ctd"], [project({ project_id: 1 })]);

            expect(outcome.outcome).toBe("finished");
            expect(log_messages.some(m => m.includes("CTD: skipping sample 'no_ctd' (no CTD imported)"))).toBe(true);
            expect(log_messages.some(m => m.includes("CTD: file not found on disk for sample 'ctd_gone'"))).toBe(true);
        });
    });

    describe("ecotaxa step", () => {
        test("one export call per linked project, with only the imported sample names", async () => {
            const calls: Array<{ project_id: number, sample_names: string[], exclude: boolean, dest: string }> = [];
            jest.spyOn(mockEcotaxaAccountRepository, "exportObjectSetGeneral").mockImplementation(
                ((p: any, sample_names: string[], exclude: boolean, dest: string) => {
                    calls.push({ project_id: p.project_id, sample_names, exclude, dest });
                    fs.writeFileSync(dest, "ecotaxa-zip-payload");
                    return Promise.resolve();
                }) as any);

            await runExport([
                validated(sampleModel_1, { sample_id: 1, project_id: 1, sample_name: "in_ecotaxa", ecotaxa_sample_imported: true }),
                validated(sampleModel_2, { sample_id: 2, project_id: 1, sample_name: "not_in_ecotaxa", ecotaxa_sample_imported: false }),
                validated(sampleModel_1, { sample_id: 3, project_id: 2, sample_name: "no_linked_project", ecotaxa_sample_imported: true }),
            ], ["ecotaxa"], [
                project({ project_id: 1, ecotaxa_project_id: 55 }),
                project({ project_id: 2, ecotaxa_project_id: null }),
            ]);

            expect(calls).toHaveLength(1);
            expect(calls[0].project_id).toBe(1);
            expect(calls[0].sample_names).toEqual(["in_ecotaxa"]);
            expect(calls[0].exclude).toBe(false);
            expect(await zipEntries(zip_path())).toContain("ecotaxa/1/ecotaxa_export_1.zip");
            expect(log_messages.some(m => m.includes("EcoTaxa: skipping sample 'not_in_ecotaxa' (not imported into EcoTaxa)"))).toBe(true);
            expect(log_messages.some(m => m.includes("has no linked EcoTaxa project"))).toBe(true);
        });

        test("an EcoTaxa API failure fails the whole task — unlike the per-sample skips", async () => {
            jest.spyOn(mockEcotaxaAccountRepository, "exportObjectSetGeneral").mockImplementation(() => Promise.reject(new Error("EcoTaxa is down")));

            const outcome = await runExport([validated(sampleModel_1, { sample_id: 1, project_id: 1, ecotaxa_sample_imported: true })],
                ["ecotaxa"], [project({ project_id: 1, ecotaxa_project_id: 55 })]);

            expect(outcome.outcome).toBe("failed");
            expect((outcome.detail as Error).message).toBe("EcoTaxa is down");
            expect(log_messages.some(m => m.includes("EcoTaxa: export failed for project 1: EcoTaxa is down"))).toBe(true);
            expect(fs.existsSync(zip_path())).toBe(false);
        });
    });

    describe("descent-filter columns", () => {
        // A depth profile that goes down, comes back up twice, then down again: with the filter on,
        // the two ascent images are dropped and the last kept image is the deepest one.
        const records = [
            { image_index: 0, image_id: "img_0", raw_pressure: 100, light_on: true, spectrum_counts: {} },
            { image_index: 1, image_id: "img_1", raw_pressure: 200, light_on: true, spectrum_counts: {} },
            { image_index: 2, image_id: "img_2", raw_pressure: 150, light_on: true, spectrum_counts: {} }, // ascent
            { image_index: 3, image_id: "img_3", raw_pressure: 300, light_on: true, spectrum_counts: {} },
            { image_index: 4, image_id: "img_4", raw_pressure: 250, light_on: true, spectrum_counts: {} }, // ascent
        ];

        function sampleWithWindow(overrides: Partial<PublicSampleModel> = {}): PublicSampleModel {
            return validated(sampleModel_1, {
                sample_id: 1, project_id: 1, sample_name: "descent_sample",
                sample_type_label: "Depth", filter_first_image: "img_0", filter_last_image: "img_4",
                ...overrides,
            });
        }

        test("reports the images the filter drops and the deepest image kept", async () => {
            jest.spyOn(mockSampleRepository, "getPerImageRecords").mockImplementation(() => Promise.resolve(records as any));

            await runExport([sampleWithWindow()], ["metadata"], [project({ project_id: 1, enable_descent_filter: true })]);

            const { rows } = parseTsv(await zipEntryContent(zip_path(), "metadata/samples.tsv"));
            expect(rows[0].filter_last_image_used).toBe("img_3");
            expect(rows[0].filter_removed_images_count).toBe("2");
            expect(rows[0].filter_removed_images_percent).toBe("40");
            // The raw header bounds are still exported as-is next to them.
            expect(rows[0].filter_first_image).toBe("img_0");
            expect(rows[0].filter_last_image).toBe("img_4");
        });

        test("nothing is removed when the project has the descent filter disabled", async () => {
            jest.spyOn(mockSampleRepository, "getPerImageRecords").mockImplementation(() => Promise.resolve(records as any));

            await runExport([sampleWithWindow()], ["metadata"], [project({ project_id: 1, enable_descent_filter: false })]);

            const { rows } = parseTsv(await zipEntryContent(zip_path(), "metadata/samples.tsv"));
            expect(rows[0].filter_removed_images_count).toBe("0");
            expect(rows[0].filter_last_image_used).toBe("img_4");
        });

        test("a time-based sample is never filtered, whatever the project setting", async () => {
            jest.spyOn(mockSampleRepository, "getPerImageRecords").mockImplementation(() => Promise.resolve(records as any));

            await runExport([sampleWithWindow({ sample_type_label: "Time" })], ["metadata"],
                [project({ project_id: 1, enable_descent_filter: true })]);

            const { rows } = parseTsv(await zipEntryContent(zip_path(), "metadata/samples.tsv"));
            expect(rows[0].filter_removed_images_count).toBe("0");
        });

        test("an unreadable particle file leaves the three cells empty and is logged, export succeeds", async () => {
            jest.spyOn(mockSampleRepository, "getPerImageRecords")
                .mockImplementation(() => Promise.reject(new Error("File not found in zip")));

            const outcome = await runExport([sampleWithWindow()], ["metadata"], [project({ project_id: 1, enable_descent_filter: true })]);

            expect(outcome.outcome).toBe("finished");
            const { rows } = parseTsv(await zipEntryContent(zip_path(), "metadata/samples.tsv"));
            expect(rows[0].filter_last_image_used).toBe("");
            expect(rows[0].filter_removed_images_count).toBe("");
            expect(rows[0].filter_removed_images_percent).toBe("");
            expect(log_messages.some(m => m.includes("Descent filter: cannot compute image filtering for sample 'descent_sample'"))).toBe(true);
        });
    });

    describe("partial export (skip_not_validated)", () => {
        test("only the validated samples reach samples.tsv, and the task log names the excluded ones", async () => {
            const mixed = [
                validated(sampleModel_1, { sample_id: 1, project_id: 1, sample_name: "ok_sample" }),
                { ...sampleModel_2, sample_id: 2, project_id: 1, sample_name: "pending_sample", visual_qc_status_label: "PENDING" },
                { ...sampleModel_2, sample_id: 3, project_id: 1, sample_name: "rejected_sample", visual_qc_status_label: "REJECTED" },
            ];

            const outcome = await runExport(mixed, ["metadata"], [project({ project_id: 1 })], { skip_not_validated: true });

            expect(outcome.outcome).toBe("finished");
            const { rows } = parseTsv(await zipEntryContent(zip_path(), "metadata/samples.tsv"));
            expect(rows.map(r => r.sample_name)).toEqual(["ok_sample"]);
            // The count of exported samples follows the filtered basket, not the request.
            const { rows: project_rows } = parseTsv(await zipEntryContent(zip_path(), "metadata/projects.tsv"));
            expect(project_rows[0].project_total_samples_exported).toBe("1");
            // The archive holds no trace of the dropped samples, so the log must carry it.
            expect(log_messages.some(m => m.includes("QC: 2 sample(s) excluded")
                && m.includes("pending_sample (PENDING)") && m.includes("rejected_sample (REJECTED)"))).toBe(true);
        });

        test("nothing is logged about QC when every requested sample is validated", async () => {
            await runExport([validated(sampleModel_1, { sample_id: 1, project_id: 1 })], ["metadata"],
                [project({ project_id: 1 })], { skip_not_validated: true });

            expect(log_messages.some(m => m.startsWith("QC:"))).toBe(false);
        });
    });

    describe("README", () => {
        test("documents exactly the columns of the TSVs that were produced", async () => {
            await runExport([validated(sampleModel_1, { sample_id: 1, project_id: 1 })], ["metadata"], [project({ project_id: 1 })]);

            const readme = await zipEntryContent(zip_path(), "README.md");
            const { headers: project_headers } = parseTsv(await zipEntryContent(zip_path(), "metadata/projects.tsv"));
            const { headers: sample_headers } = parseTsv(await zipEntryContent(zip_path(), "metadata/samples.tsv"));

            for (const column of [...project_headers, ...sample_headers]) {
                expect(readme).toContain(`\`${column}\``);
            }
        });
    });
});
