import fs from "fs";
import os from "os";
import path from "path";
import archiver from "archiver";
import { SampleRepositoryImpl } from "../../../src/domain/repositories/sample-repository";
import { Uvp5PivotSampleMetadata } from "../../../src/domain/entities/pivot";
import { UVP5_PIVOT_CONVERTER_VERSION } from "../../../src/domain/utils/uvp5-pivot-converter";

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

const SAMPLE: Uvp5PivotSampleMetadata = {
    sample_name: "s1c1",
    filter_first_image: "12",
    filter_last_image: "9.9999999999E10",
    instrument_settings_aa: 0.0026,
    instrument_settings_exp: 1.2284,
    instrument_settings_image_volume_l: 1.2242,
    instrument_settings_pixel_size_mm: 0.093,
    instrument_settings_acq_threshold: 3,
    instrument_settings_acq_gain: 200,
    instrument_settings_acq_exposure: 240,
    instrument_settings_particule_minimum_area_pixels: 2,
};

describe("UVP5 pivot storage", () => {
    let base_folder: string;
    let sample_folder: string;
    let repo: SampleRepositoryImpl;

    beforeEach(async () => {
        base_folder = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-pivot-"));
        sample_folder = path.join(base_folder, "storage", "5", "s1c1");
        fs.mkdirSync(sample_folder, { recursive: true });
        await writeZip(path.join(sample_folder, "s1c1_work.zip"), {
            "s1c1_datfile.txt": "    12;\t20200806221354_586;\t00136;00182!;\t2;\t4;\t12;\t0;\t0;\r\n",
            "s1c1.bru": "12;0;3;10;1;1\r\n12;1;3;21;1;1\r\n",
        });
        await writeZip(path.join(sample_folder, "s1c1_meta_conf.zip"), {
            "meta/uvp5_header_sn222_hot.txt": "cruise;profileid;firstimage\r\nc1;s1c1;12\r\n",
        });
        repo = new SampleRepositoryImpl({} as any, "storage");
        repo.base_folder = base_folder;
    });

    afterEach(() => {
        fs.rmSync(base_folder, { recursive: true, force: true });
    });

    test("writes <sample>/pivot/<sample>_Particule.zip with its three members and no temporary file", async () => {
        const report = await repo.generateUvp5Pivot(5, SAMPLE, "UVP5HD");

        const pivot_zip = path.join(sample_folder, "pivot", "s1c1_Particule.zip");
        expect(report.frames_written).toBe(1);
        expect(fs.existsSync(pivot_zip)).toBe(true);
        expect(fs.readdirSync(path.join(sample_folder, "pivot"))).toEqual(["s1c1_Particule.zip"]);
        const read = (name: string) => (repo as any).readFileFromZip(pivot_zip, name);
        expect(await read("particules.csv")).toBe("20200806-221354-586,13.6,,1:3,2,15.5,\n");
        expect(await read("frames.csv")).toBe("image_id;frame_index\n20200806-221354-586;12\n");
        expect(await read("metadata.ini")).toContain("source_instrument=UVP5HD\n");
    });

    test("reads back the converter version of the pivot, null when the sample has none", async () => {
        expect(await repo.getPivotConverterVersion(5, "s1c1")).toBeNull();

        await repo.generateUvp5Pivot(5, SAMPLE, "UVP5HD");

        expect(await repo.getPivotConverterVersion(5, "s1c1")).toBe(UVP5_PIVOT_CONVERTER_VERSION);
    });

    test("is never picked up by the archive recovery", async () => {
        await repo.generateUvp5Pivot(5, SAMPLE, "UVP5HD");

        const lpm = await repo.listRawFilesForSample("UVP5HD", 5, "s1c1", "lpm");

        expect(lpm).toEqual([path.join(sample_folder, "s1c1_work.zip")]);
    });

    test("fails with an explicit error naming the missing file, and leaves no pivot", async () => {
        await writeZip(path.join(sample_folder, "s1c1_work.zip"), { "s1c1_datfile.txt": "" });

        await expect(repo.generateUvp5Pivot(5, SAMPLE, "UVP5HD")).rejects.toThrow(
            /^Cannot build the UVP5 pivot of sample s1c1: cannot read s1c1\.bru in s1c1_work\.zip \(.*\)\. Check that the file is in the sample folder of the project, then relaunch the import or the pivot regeneration\.$/);
        expect(fs.existsSync(path.join(sample_folder, "pivot"))).toBe(false);
    });
});
