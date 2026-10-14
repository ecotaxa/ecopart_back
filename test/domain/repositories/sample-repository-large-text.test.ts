import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import archiver from "archiver";
import * as tar from "tar";

import { SampleRepositoryImpl } from "../../../src/domain/repositories/sample-repository";
import * as decodeModule from "../../../src/domain/utils/decode-uvp-text";

const STRING_TOO_LONG = "Cannot create a string longer than 0x1fffffe8 characters";

function writeZip(zip_path: string, members: Record<string, string | Buffer>): Promise<void> {
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

// A zstd frame of raw (stored) blocks: valid Zstandard without needing a compressor.
function zstdRawFrame(content: Buffer): Buffer {
    const header = Buffer.alloc(13);
    header.writeUInt32LE(0xFD2FB528, 0);
    header[4] = 0xE0; // single segment, 8-byte content size
    header.writeBigUInt64LE(BigInt(content.length), 5);
    const parts = [header];
    const MAX_BLOCK = 128 * 1024;
    for (let offset = 0; offset < content.length || offset === 0; offset += MAX_BLOCK) {
        const block = content.subarray(offset, offset + MAX_BLOCK);
        const block_header = Buffer.alloc(3);
        block_header.writeUIntLE((block.length << 3) | (offset + MAX_BLOCK >= content.length ? 1 : 0), 0, 3);
        parts.push(block_header, block);
    }
    return Buffer.concat(parts);
}

// Writes `members` under `folder` and packs them, in this order, into a .tar.zst.
function writeTar(tar_zst_path: string, folder: string, members: Record<string, string | Buffer>, preservePaths = false): void {
    for (const [name, content] of Object.entries(members)) {
        fs.mkdirSync(path.dirname(path.join(folder, name)), { recursive: true });
        fs.writeFileSync(path.join(folder, name), content);
    }
    const tar_path = `${tar_zst_path}.tar`;
    tar.c({ sync: true, file: tar_path, cwd: folder, preservePaths }, Object.keys(members));
    fs.writeFileSync(tar_zst_path, zstdRawFrame(fs.readFileSync(tar_path)));
    fs.rmSync(tar_path);
}

describe("reading text from sample archives", () => {
    let tmp: string;
    let repo: SampleRepositoryImpl;
    const getAll = jest.fn();

    beforeEach(() => {
        jest.restoreAllMocks();
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-large-text-"));
        getAll.mockReset().mockResolvedValue({ items: [], total: 0 });
        repo = new SampleRepositoryImpl({ getAll } as any, "");
        repo.base_folder = tmp;
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    describe("readFileFromZip", () => {
        const read = (zip: string, name: string) => (repo as any).readFileFromZip(zip, name);

        test("returns the text of the member", async () => {
            const zip = path.join(tmp, "a.zip");
            await writeZip(zip, { "small.txt": "line 1\nline 2\n" });

            await expect(read(zip, "small.txt")).resolves.toBe("line 1\nline 2\n");
        });

        test("rejects a member over the text limit without reading it", async () => {
            const zip = path.join(tmp, "a.zip");
            await writeZip(zip, { "big.txt": "12345678901" });
            repo.max_text_file_bytes = 10;
            const decode = jest.spyOn(decodeModule, "decodeUvpText");

            await expect(read(zip, "big.txt")).rejects.toThrow("big.txt in a.zip is too large to be read as text (11 bytes, at most 10)");
            expect(decode).toBeCalledTimes(0);
        });

        test("rejects when the decoding fails instead of throwing from the stream callback", async () => {
            const zip = path.join(tmp, "a.zip");
            await writeZip(zip, { "small.txt": "abc" });
            jest.spyOn(decodeModule, "decodeUvpText").mockImplementationOnce(() => { throw new Error(STRING_TOO_LONG); });

            await expect(read(zip, "small.txt")).rejects.toThrow(STRING_TOO_LONG);
        });

        test("still rejects a missing member", async () => {
            const zip = path.join(tmp, "a.zip");
            await writeZip(zip, { "small.txt": "abc" });

            await expect(read(zip, "other.txt")).rejects.toThrow("other.txt or undefined not found in zip file");
        });
    });

    describe("readFileFromTarZst", () => {
        const read = (archive: string, name: string) => (repo as any).readFileFromTarZst(archive, name);

        test("returns the text of the member", async () => {
            const archive = path.join(tmp, "s.tar.zst");
            writeTar(archive, path.join(tmp, "content"), { "s/small.txt": "abc\n" });

            await expect(read(archive, "small.txt")).resolves.toBe("abc\n");
        });

        test("rejects a member over the text limit without reading it", async () => {
            const archive = path.join(tmp, "s.tar.zst");
            writeTar(archive, path.join(tmp, "content"), { "s/big.txt": "12345678901" });
            repo.max_text_file_bytes = 10;
            const decode = jest.spyOn(decodeModule, "decodeUvpText");

            await expect(read(archive, "big.txt")).rejects.toThrow("s/big.txt in s.tar.zst is too large to be read as text (11 bytes, at most 10)");
            expect(decode).toBeCalledTimes(0);
        });

        test("rejects a missing member or a corrupted archive", async () => {
            const archive = path.join(tmp, "s.tar.zst");
            writeTar(archive, path.join(tmp, "content"), { "s/small.txt": "abc" });
            fs.writeFileSync(path.join(tmp, "corrupted.tar.zst"), Buffer.from("not zstandard data"));

            await expect(read(archive, "other.txt")).rejects.toThrow("other.txt or undefined not found in tar.zst file");
            await expect(read(path.join(tmp, "corrupted.tar.zst"), "small.txt")).rejects.toThrow();
        });

        test("rejects when the decoding fails instead of throwing from the stream callback", async () => {
            const archive = path.join(tmp, "s.tar.zst");
            writeTar(archive, path.join(tmp, "content"), { "s/small.txt": "abc" });
            jest.spyOn(decodeModule, "decodeUvpText").mockImplementationOnce(() => { throw new Error(STRING_TOO_LONG); });

            await expect(read(archive, "small.txt")).rejects.toThrow(STRING_TOO_LONG);
        });
    });

    describe("countTsvDataLines", () => {
        const inputs = [
            "",
            "header only\n",
            "h\r\na\r\nb\r\n",
            "h\ra\rb",
            "h\n\n  \t\na\n \nb\nc",
            "object_id\tarea\r\n[t]\t[f]\r\nx\t1\r\n\r\n",
        ];

        test.each(inputs)("counts %j like extractNumberOfTsvDataLines, whatever the chunking", async (input) => {
            const bytes = Buffer.from(input);
            const one_byte_chunks = Readable.from(Array.from(bytes, (byte) => Buffer.from([byte])));

            const expected = repo.extractNumberOfTsvDataLines(input);
            await expect((repo as any).countTsvDataLines(Readable.from([bytes]))).resolves.toBe(expected);
            await expect((repo as any).countTsvDataLines(one_byte_chunks)).resolves.toBe(expected);
        });
    });

    describe("listImportableSamples vignette count", () => {
        const TSV = "object_id\tarea\r\na\t1\r\nb\t2\r\n\r\nc\t3\n";

        beforeEach(() => {
            fs.mkdirSync(path.join(tmp, "storage", "1"), { recursive: true });
            // Any TSV read as one string is now refused: the count must stream it.
            repo.max_text_file_bytes = 10;
        });

        test("counts a UVP6 TSV larger than the text limit", async () => {
            fs.mkdirSync(path.join(tmp, "uvp6_m1", "meta"), { recursive: true });
            fs.writeFileSync(path.join(tmp, "uvp6_m1", "meta", "uvp6_header_m1.txt"), "cruise;ship;filename;profileid\nm1;ship;file_a;mooring_1\n");
            fs.mkdirSync(path.join(tmp, "uvp6_m1", "ecodata", "mooring_1"), { recursive: true });
            await writeZip(path.join(tmp, "uvp6_m1", "ecodata", "mooring_1", "mooring_1_Images.zip"), { "ecotaxa_mooring_1.tsv": TSV });

            const samples = await repo.listImportableSamples("uvp6_m1", "UVP6LP", path.join(tmp, "storage", "1"), 1);

            expect(samples.map(sample => [sample.sample_name, sample.vignette_number])).toEqual([["mooring_1", 3]]);
        });

        test("counts UVP5 TSVs larger than the text limit, zipped or in a plain work folder", async () => {
            fs.mkdirSync(path.join(tmp, "uvp5_m1", "meta"), { recursive: true });
            fs.writeFileSync(path.join(tmp, "uvp5_m1", "meta", "uvp5_header_m1.txt"), "cruise;ship;filename;profileid\nm1;ship;file_a;zipped\nm1;ship;file_b;plain\n");
            fs.mkdirSync(path.join(tmp, "uvp5_m1", "work", "plain"), { recursive: true });
            await writeZip(path.join(tmp, "uvp5_m1", "work", "zipped.zip"), { "zipped/ecotaxa_zipped.tsv": TSV });
            fs.writeFileSync(path.join(tmp, "uvp5_m1", "work", "plain", "ecotaxa_plain.tsv"), TSV);

            const samples = await repo.listImportableSamples("uvp5_m1", "UVP5HD", path.join(tmp, "storage", "1"), 1);

            expect(samples.map(sample => [sample.sample_name, sample.vignette_number])).toEqual([["zipped", 3], ["plain", 3]]);
        });

        test("does not count the vignettes of samples already imported", async () => {
            fs.mkdirSync(path.join(tmp, "uvp6_m1", "meta"), { recursive: true });
            fs.writeFileSync(path.join(tmp, "uvp6_m1", "meta", "uvp6_header_m1.txt"), "cruise;ship;filename;profileid\nm1;ship;file_a;in_db\nm1;ship;file_b;in_storage\nm1;ship;file_c;new\n");
            for (const name of ["in_db", "in_storage", "new"]) {
                fs.mkdirSync(path.join(tmp, "uvp6_m1", "ecodata", name), { recursive: true });
                await writeZip(path.join(tmp, "uvp6_m1", "ecodata", name, `${name}_Images.zip`), { [`ecotaxa_${name}.tsv`]: TSV });
            }
            fs.mkdirSync(path.join(tmp, "storage", "1", "in_storage"), { recursive: true });
            getAll.mockResolvedValue({ items: [{ sample_name: "in_db" }], total: 1 });
            const count = jest.spyOn(repo as any, "getImportableSampleImagesCount");

            const samples = await repo.listImportableSamples("uvp6_m1", "UVP6LP", path.join(tmp, "storage", "1"), 1);

            expect(samples.map(sample => [sample.sample_name, sample.vignette_number, sample.qc_lvl1])).toEqual([["new", 3, true]]);
            expect(count).toBeCalledTimes(1);
            expect(count).toBeCalledWith(expect.any(String), "UVP6LP", "new");
        });
    });

    describe("countTsvImages", () => {
        test("counts the distinct img_file_name values, blank lines ignored", async () => {
            const tsv = ["object_id\timg_file_name", "", "a\timg_1.jpg", "b\timg_1.jpg", "  ", "c\timg_2.jpg", "d\t"];

            await expect(repo.countTsvImages(tsv)).resolves.toBe(2);
        });

        test("is 0 for a header without any data row, even without img_file_name", async () => {
            await expect(repo.countTsvImages(["object_id\tarea", ""])).resolves.toBe(0);
        });

        test("rejects a TSV with data rows but no img_file_name column", async () => {
            await expect(repo.countTsvImages(["object_id\tarea", "a\t1"])).rejects.toThrow("Column 'img_file_name' not found");
        });
    });

    describe("files over the text limit read line by line", () => {
        const PARTICULES_CSV = [
            "HW_CONF,000112LP,2,UNDEFINED,40",
            "20210506-083733-1,NaN,23.19,1:1,10,30.8,8.8;",
            "20210506-083734-1,12.5,23.19,0:1,10,30.8,8.8;2,4,36.5,16.9",
            "20210506-083735-1,8.0,23.19,1:1,10,30.8,8.8;",
        ].join("\r\n");
        const ECOTAXA_TSV = "object_id\timg_file_name\r\na\timg_1.jpg\r\nb\timg_1.jpg\r\nc\timg_2.jpg\r\n";

        beforeEach(() => {
            repo.max_text_file_bytes = 10;
        });

        test("UVP6 particules.csv: max pressure, black images and QC records", async () => {
            const sample_folder = path.join(tmp, "7", "mooring_1");
            fs.mkdirSync(sample_folder, { recursive: true });
            await writeZip(path.join(sample_folder, "mooring_1_Particule.zip"), { "particules.csv": PARTICULES_CSV });

            await expect(repo.computeMaxPressure(path.join(tmp, "7"), "mooring_1")).resolves.toBe(12.5);
            await expect(repo.countBlackParticulesUvp6(path.join(tmp, "7"), "mooring_1")).resolves.toBe(1);
            await expect(repo.getPerImageRecords(7, "mooring_1", "UVP6LP")).resolves.toEqual(repo.parseParticulesCsvRecords(PARTICULES_CSV));
            await expect(repo.getPivotImageRecords(7, "mooring_1", "UVP6LP")).resolves.toEqual(repo.parsePivotParticulesCsv(PARTICULES_CSV));
        });

        test("EcoTaxa TSV of a UVP6 sample: images counted", async () => {
            fs.mkdirSync(path.join(tmp, "ecodata", "mooring_1"), { recursive: true });
            await writeZip(path.join(tmp, "ecodata", "mooring_1", "mooring_1_Images.zip"), { "ecotaxa_mooring_1.tsv": ECOTAXA_TSV });

            const samples = await repo.getEcoTaxaSamplesFromUVP6Format(path.join(tmp, "ecodata"), [{ sample_name: "mooring_1", sample_id: 4 }]);

            expect(samples.map(sample => [sample.sample_name, sample.images])).toEqual([["mooring_1", 2]]);
        });

        test("EcoTaxa TSV of a UVP5 sample: images counted", async () => {
            fs.mkdirSync(path.join(tmp, "work", "profile_1"), { recursive: true });
            await writeZip(path.join(tmp, "work", "profile_1", "profile_1_work.zip"), { "ecotaxa_profile_1.tsv": ECOTAXA_TSV });

            const samples = await repo.getEcoTaxaSamplesFromUVP5Format(path.join(tmp, "work"), [{ sample_name: "profile_1", sample_id: 5 }]);

            expect(samples.map(sample => [sample.sample_name, sample.images])).toEqual([["profile_1", 2]]);
        });
    });

    describe("UVP5 work archive extraction, streamed to disk", () => {
        // Larger than a zstd block (128 KiB) and than the stream chunks.
        const IMAGE = Buffer.from(Array.from({ length: 300_000 }, (_, i) => (i * 7) % 256));
        const MEMBERS = {
            "s1/s1_datfile.txt": "datfile",
            "s1/images/img_1.png": IMAGE,
            "s1/.DS_Store": "junk",
            "__MACOSX/s1/._s1_datfile.txt": "junk",
        };

        const expectExtracted = (dest: string) => {
            expect(fs.readdirSync(dest).sort()).toEqual(["images", "s1_datfile.txt"]);
            expect(fs.readFileSync(path.join(dest, "s1_datfile.txt"), "utf8")).toBe("datfile");
            expect(fs.readFileSync(path.join(dest, "images", "img_1.png")).equals(IMAGE)).toBe(true);
            expect(fs.existsSync(`${dest}.extracting`)).toBe(false);
        };

        test("zip: the common top folder is stripped and macOS metadata left out", async () => {
            await writeZip(path.join(tmp, "s1.zip"), MEMBERS);
            const dest = path.join(tmp, "out", "s1_work");

            await repo.extractZipNormalized(path.join(tmp, "s1.zip"), dest);

            expectExtracted(dest);
        });

        test("zip: files without a common top folder keep their paths", async () => {
            await writeZip(path.join(tmp, "s1.zip"), { "a.txt": "a", "sub/b.txt": "b" });
            const dest = path.join(tmp, "out", "s1_work");

            await repo.extractZipNormalized(path.join(tmp, "s1.zip"), dest);

            expect(fs.readFileSync(path.join(dest, "a.txt"), "utf8")).toBe("a");
            expect(fs.readFileSync(path.join(dest, "sub", "b.txt"), "utf8")).toBe("b");
        });

        test("tar.zst: the common top folder is stripped and macOS metadata left out", async () => {
            writeTar(path.join(tmp, "s1.tar.zst"), path.join(tmp, "content"), MEMBERS);
            const dest = path.join(tmp, "out", "s1_work");

            await repo.extractTarZstNormalized(path.join(tmp, "s1.tar.zst"), dest);

            expectExtracted(dest);
        });

        test("tar.zst: an entry outside the folder fails the extraction and is not written", async () => {
            writeTar(path.join(tmp, "s1.tar.zst"), path.join(tmp, "content", "inner"), { "s1/a.txt": "a", "../evil.txt": "evil" }, true);
            const dest = path.join(tmp, "out", "s1_work");

            await expect(repo.extractTarZstNormalized(path.join(tmp, "s1.tar.zst"), dest)).rejects.toThrow("s1.tar.zst has an entry outside its folder: ../evil.txt");
            expect(fs.existsSync(path.join(tmp, "out", "evil.txt"))).toBe(false);
            expect(fs.existsSync(`${dest}.extracting`)).toBe(false);
        });

        test("tar.zst: a corrupted archive rejects and leaves nothing behind", async () => {
            fs.writeFileSync(path.join(tmp, "s1.tar.zst"), Buffer.from("not zstandard data"));
            const dest = path.join(tmp, "out", "s1_work");

            await expect(repo.extractTarZstNormalized(path.join(tmp, "s1.tar.zst"), dest)).rejects.toThrow();
            expect(fs.existsSync(dest)).toBe(false);
            expect(fs.existsSync(`${dest}.extracting`)).toBe(false);
        });
    });

    describe("UVP5 source .bru read line by line", () => {
        const DATFILE = "    12;\t20200806221354_586;\t00136;00182!;\t2;\t4;\t12;\t0;\t0;\r\n";
        const BRU = "12;0;3;10;1;1\r\n".repeat(500);

        beforeEach(() => {
            // The datfile still fits, the .bru does not: it must be streamed.
            repo.max_text_file_bytes = 200;
        });

        test.each(["tar.zst", "zip", "folder"])("QC preview from a %s work source", async (form) => {
            const work = path.join(tmp, "source", "work");
            fs.mkdirSync(work, { recursive: true });
            const members = { "s1/s1_datfile.txt": DATFILE, "s1/s1.bru": BRU };
            if (form === "tar.zst") writeTar(path.join(work, "s1.tar.zst"), path.join(tmp, "content"), members);
            if (form === "zip") await writeZip(path.join(work, "s1.zip"), members);
            if (form === "folder") {
                fs.mkdirSync(path.join(work, "s1"));
                fs.writeFileSync(path.join(work, "s1", "s1_datfile.txt"), DATFILE);
                fs.writeFileSync(path.join(work, "s1", "s1.bru"), BRU);
            }

            const records = await repo.getPerImageRecordsFromSource("source", "s1", "UVP5HD");

            expect(records.map(record => record.spectrum_counts)).toEqual([{ 3: 500 }]);
        });
    });
});
