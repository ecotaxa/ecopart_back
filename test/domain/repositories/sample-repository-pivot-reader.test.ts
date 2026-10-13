import fs from "fs";
import os from "os";
import path from "path";
import archiver from "archiver";
import { SampleRepositoryImpl } from "../../../src/domain/repositories/sample-repository";

function writeZip(zip_path: string, members: Record<string, string>): Promise<void> {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zip_path);
        const archive = archiver("zip");
        output.on("close", () => resolve());
        archive.on("error", reject);
        archive.pipe(output);
        for (const [name, content] of Object.entries(members)) archive.append(content, { name });
        archive.finalize();
    });
}

describe("parsePivotParticulesCsv", () => {
    const repo = new SampleRepositoryImpl({} as any, "");

    test("keeps every block with its mean grey, the first one glued to the light flag", () => {
        const records = repo.parsePivotParticulesCsv([
            "HW_CONF,000213LP,0,UNDEFINED",
            "20240612-003906-1,3.13,15,1:1,5117,29.3,10.5;2,498,36.5,16.9;3,101,43.4,24.0;",
        ].join("\n"));

        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({ image_id: "20240612-003906-1", raw_pressure: 3.13, light_on: true, spectrum_counts: { 1: 5117, 2: 498, 3: 101 } });
        expect(records[0].blocks).toEqual([
            { area_px: 1, nb_particles: 5117, grey_mean: 29.3 },
            { area_px: 2, nb_particles: 498, grey_mean: 36.5 },
            { area_px: 3, nb_particles: 101, grey_mean: 43.4 },
        ]);
    });

    test("reads a converted UVP5 line: empty grey_std, and an image without particle", () => {
        const records = repo.parsePivotParticulesCsv([
            "20200806-221354-586,13.6,39,1:2,4,26.3,;5,1,12.0,",
            "20200806-221355-001,13.7,39,1:",
        ].join("\n"));

        expect(records[0].blocks).toEqual([
            { area_px: 2, nb_particles: 4, grey_mean: 26.3 },
            { area_px: 5, nb_particles: 1, grey_mean: 12 },
        ]);
        expect(records[1]).toMatchObject({ light_on: true, blocks: [], spectrum_counts: {} });
    });

    test("a block without grey keeps its count, a sentinel line has no block", () => {
        const records = repo.parsePivotParticulesCsv([
            "20240612-003907-1,3.20,15,0:1,7,,",
            "20240612-003908-1,3.30,15,1:OVER_EXPOSED",
        ].join("\n"));

        expect(records[0]).toMatchObject({ light_on: false, blocks: [{ area_px: 1, nb_particles: 7, grey_mean: null }] });
        expect(records[1]).toMatchObject({ particle_data_flag: "OVER_EXPOSED", blocks: [] });
    });

    test("the QC-graph parser reads the same lines without the blocks", () => {
        const content = "20240612-003906-1,3.13,15,1:1,5117,29.3,10.5;2,498,36.5,16.9";
        const qc_record = repo.parseParticulesCsvRecords(content)[0];
        expect(qc_record).toEqual({ ...repo.parsePivotParticulesCsv(content)[0], blocks: undefined });
        expect(qc_record).not.toHaveProperty("blocks");
    });
});

describe("getPivotImageRecords", () => {
    let base_folder: string;
    let repo: SampleRepositoryImpl;

    beforeEach(() => {
        base_folder = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-pivot-reader-"));
        repo = new SampleRepositoryImpl({} as any, "storage");
        repo.base_folder = base_folder;
    });

    afterEach(() => {
        fs.rmSync(base_folder, { recursive: true, force: true });
    });

    test("a UVP5 sample is read from the pivot built at import", async () => {
        const pivot_folder = path.join(base_folder, "storage", "5", "s1c1", "pivot");
        fs.mkdirSync(pivot_folder, { recursive: true });
        await writeZip(path.join(pivot_folder, "s1c1_Particule.zip"), { "particules.csv": "20200806-221354-586,13.6,39,1:2,4,26.3,\n" });

        const records = await repo.getPivotImageRecords(5, "s1c1", "UVP5HD");

        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({ raw_pressure: 13.6, blocks: [{ area_px: 2, nb_particles: 4, grey_mean: 26.3 }] });
    });

    test("a UVP6 sample is read from its imported particle file", async () => {
        const sample_folder = path.join(base_folder, "storage", "19", "HS1447C1");
        fs.mkdirSync(sample_folder, { recursive: true });
        await writeZip(path.join(sample_folder, "HS1447C1_Particule.zip"), { "particules.csv": "20230406-144332-1,1.2,28,1:1,12,30.1,9.0\n", "metadata.ini": "[HW_CONF]\n" });

        const records = await repo.getPivotImageRecords(19, "HS1447C1", "UVP6HF");

        expect(records[0].blocks).toEqual([{ area_px: 1, nb_particles: 12, grey_mean: 30.1 }]);
    });

    test("closes each archive once its file is read, leaving no descriptor open", async () => {
        const sample_folder = path.join(base_folder, "storage", "19", "HS1447C1");
        fs.mkdirSync(sample_folder, { recursive: true });
        await writeZip(path.join(sample_folder, "HS1447C1_Particule.zip"), { "metadata.ini": "[HW_CONF]\n", "particules.csv": "20230406-144332-1,1.2,28,1:1,12,30.1,9.0\n" });
        const openDescriptors = () => fs.readdirSync("/dev/fd").length;

        await repo.getPivotImageRecords(19, "HS1447C1", "UVP6HF");
        const before = openDescriptors();
        for (let i = 0; i < 30; i++) await repo.getPivotImageRecords(19, "HS1447C1", "UVP6HF");

        // Before the fix, every read left one descriptor open.
        expect(openDescriptors() - before).toBeLessThan(5);
    });

    test("a missing file is reported with the sample name", async () => {
        await expect(repo.getPivotImageRecords(5, "s1c1", "UVP5HD")).rejects.toThrow(/^Cannot read the particle file of sample s1c1/);
    });

    test("an instrument without a UVP6-format file is refused", async () => {
        await expect(repo.getPivotImageRecords(5, "lisst_1", "LISST")).rejects.toThrow("Unknown instrument model");
    });
});
