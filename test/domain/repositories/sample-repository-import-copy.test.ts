import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SampleRepositoryImpl } from "../../../src/domain/repositories/sample-repository";

describe("Import copy task log", () => {
    let base_folder: string;
    let repo: SampleRepositoryImpl;
    let log: jest.Mock;

    const write = (relative_path: string, content: string) => {
        const file_path = path.join(base_folder, relative_path);
        fs.mkdirSync(path.dirname(file_path), { recursive: true });
        fs.writeFileSync(file_path, content);
    };
    const messages = (): string[] => log.mock.calls.map(([message]) => message);

    beforeEach(() => {
        base_folder = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-import-copy-"));
        repo = new SampleRepositoryImpl({} as any, "storage");
        repo.base_folder = base_folder;
        log = jest.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
        fs.rmSync(base_folder, { recursive: true, force: true });
    });

    test("UVP5: logs the work source chosen, the lower-priority forms left aside, and the written zips", async () => {
        write("project_src/work/s1/s1_datfile.txt", "1;2;3\n");
        write("project_src/work/s1/s1.hdr", "hdr");
        await repo.zipFolder(path.join(base_folder, "project_src/work/s1"), path.join(base_folder, "project_src/work/s1.zip"));
        write("project_src/meta/uvp5_header_project.txt", "header");
        write("project_src/config/cruise_info.txt", "cruise");
        write("project_src/config/uvp5_settings/uvp5_configuration_data.txt", "configuration");
        write("project_src/config/process_install_config.txt", "install");

        await repo.UVP5copySamplesToImportFolder("project_src", "storage/1", ["s1"], log);

        const zip_size = fs.statSync(path.join(base_folder, "project_src/work/s1.zip")).size;
        expect(messages()).toEqual([
            "copying 1 sample(s) from project_src to storage/1",
            `s1 (1/1) : work source project_src/work/s1.zip (${zip_size} B), ignored (lower priority): project_src/work/s1`,
            expect.stringMatching(/^s1 \(1\/1\) : work written to storage\/1\/s1\/s1_work\.zip \(\d+ B\), 2 files$/),
            expect.stringMatching(/^s1 \(1\/1\) : meta_conf written to storage\/1\/s1\/s1_meta_conf\.zip \(\d+ B\), 4 files, from project_src\/meta\/ \(1 files, 6 B\), project_src\/config\/cruise_info\.txt \(6 B\), project_src\/config\/uvp5_settings\/uvp5_configuration_data\.txt \(13 B\), project_src\/config\/process_install_config\.txt \(7 B\)$/),
        ]);
        expect(fs.existsSync(path.join(base_folder, "storage/1/s1/s1_work.zip"))).toBe(true);
        expect(fs.existsSync(path.join(base_folder, "storage/1/s1/s1_meta_conf.zip"))).toBe(true);
    });

    test("UVP5: logs the sample being copied before the copy error, then removes its partial copy", async () => {
        write("project_src/work/s1/s1_datfile.txt", "1;2;3\n");

        await expect(repo.UVP5copySamplesToImportFolder("project_src", "storage/1", ["s1"], log))
            .rejects.toThrow("Error copying meta for sample s1");

        expect(messages()).toEqual([
            "copying 1 sample(s) from project_src to storage/1",
            "s1 (1/1) : work source project_src/work/s1/ (1 files, 6 B)",
            expect.stringMatching(/^s1 \(1\/1\) : work written to storage\/1\/s1\/s1_work\.zip \(\d+ B\), 1 files$/),
            expect.stringMatching(/^Cleanup after failure : removed storage\/1\/s1\/ \(1 files, \d+ B\)$/),
        ]);
        expect(fs.existsSync(path.join(base_folder, "storage/1/s1"))).toBe(false);
    });

    test("UVP5: logs a missing work source as not found, the copy keeps its usual error", async () => {
        await expect(repo.UVP5copySamplesToImportFolder("project_src", "storage/1", ["s1"], log))
            .rejects.toThrow("Error copying work folder for sample s1");

        expect(messages()).toEqual([
            "copying 1 sample(s) from project_src to storage/1",
            "s1 (1/1) : work source project_src/work/s1 (not found)",
            "Cleanup after failure : removed storage/1/s1/ (0 files, 0 B)",
        ]);
        expect(fs.existsSync(path.join(base_folder, "storage/1/s1"))).toBe(false);
    });

    test("UVP5: a failure on a later sample also removes the samples already copied", async () => {
        write("project_src/work/s1/s1_datfile.txt", "1;2;3\n");
        write("project_src/meta/uvp5_header_project.txt", "header");
        write("project_src/config/cruise_info.txt", "cruise");
        write("project_src/config/uvp5_settings/uvp5_configuration_data.txt", "configuration");
        write("project_src/config/process_install_config.txt", "install");

        await expect(repo.UVP5copySamplesToImportFolder("project_src", "storage/1", ["s1", "s2"], log))
            .rejects.toThrow("Error copying work folder for sample s2");

        expect(messages().slice(-1)).toEqual([
            expect.stringMatching(/^Cleanup after failure : removed storage\/1\/s1\/ \(2 files, [\d.]+ K?B\), storage\/1\/s2\/ \(0 files, 0 B\)$/),
        ]);
        expect(fs.readdirSync(path.join(base_folder, "storage/1"))).toEqual([]);
    });

    test("UVP5: a sample folder already present stops the copy before anything is written or removed", async () => {
        write("project_src/work/s1/s1_datfile.txt", "1;2;3\n");
        write("storage/1/s2/s2_work.zip", "other import");

        await expect(repo.UVP5copySamplesToImportFolder("project_src", "storage/1", ["s1", "s2"], log))
            .rejects.toThrow("Sample folder already exists");

        expect(messages()).toEqual([]);
        expect(fs.readdirSync(path.join(base_folder, "storage/1"))).toEqual(["s2"]);
        expect(fs.readFileSync(path.join(base_folder, "storage/1/s2/s2_work.zip"), "utf8")).toBe("other import");
    });

    test("UVP6: logs the copied zips, the entries left aside, and a warning for a sample without zip", async () => {
        write("project_src/ecodata/s1/s1_Particule.zip", "particules");
        write("project_src/ecodata/s1/s1_Images.zip", "images");
        write("project_src/ecodata/s1/notes.txt", "notes");
        write("project_src/ecodata/s2/s2_Images.zip", "images");
        write("project_src/ecodata/s3/readme.txt", "readme");

        await repo.UVP6copySamplesToImportFolder("project_src/ecodata", "storage/1", ["s1", "s2", "s3"], log);

        const copied = messages().find(message => message.startsWith("s1 (1/3) : copied"));
        expect(copied).toContain("storage/1/s1/s1_Particule.zip (10 B)");
        expect(copied).toContain("storage/1/s1/s1_Images.zip (6 B)");
        expect(messages()).toEqual([
            "copying 3 sample(s) from project_src/ecodata to storage/1",
            copied,
            "s1 (1/3) : not copied from project_src/ecodata/s1/ : notes.txt",
            "s2 (2/3) : copied from project_src/ecodata/s2/ : storage/1/s2/s2_Images.zip (6 B)",
            "s2 (2/3) : WARNING no _Particule zip found in project_src/ecodata/s2/",
            "s3 (3/3) : WARNING no _Particule or _Images zip found in project_src/ecodata/s3/, nothing copied",
            "s3 (3/3) : not copied from project_src/ecodata/s3/ : readme.txt",
        ]);
    });

    test("UVP6: a failure on a later sample removes the copies already made", async () => {
        write("project_src/ecodata/s1/s1_Particule.zip", "particules");

        await expect(repo.UVP6copySamplesToImportFolder("project_src/ecodata", "storage/1", ["s1", "s2"], log))
            .rejects.toThrow("ENOENT");

        expect(messages()).toEqual([
            "copying 2 sample(s) from project_src/ecodata to storage/1",
            "s1 (1/2) : copied from project_src/ecodata/s1/ : storage/1/s1/s1_Particule.zip (10 B)",
            "Cleanup after failure : removed storage/1/s1/ (1 files, 10 B)",
        ]);
        expect(fs.readdirSync(path.join(base_folder, "storage/1"))).toEqual([]);
    });

    test("removing the copies returns what was actually removed, described before the removal", async () => {
        write("storage/1/s1/s1_Particule.zip", "particules");
        write("storage/1/s1/s1_Images.zip", "img");
        write("storage/1/s2.zip", "zipped");

        const removed = await repo.deleteSamplesFromImportFolder("storage/1", ["s1", "s2", "s3"]);

        expect(removed).toEqual([
            "storage/1/s1/ (2 files, 13 B)",
            "storage/1/s2.zip (6 B)",
        ]);
        expect(fs.existsSync(path.join(base_folder, "storage/1/s1"))).toBe(false);
        expect(fs.existsSync(path.join(base_folder, "storage/1/s2.zip"))).toBe(false);
    });
});
