import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import archiver from "archiver";
import * as tar from "tar";

import { SampleRepositoryImpl } from "../../../src/domain/repositories/sample-repository";
import * as decodeModule from "../../../src/domain/utils/decode-uvp-text";

// The tar.zst fixtures are plain tarballs: decompression is the identity here.
jest.mock("fzstd", () => ({ decompress: (data: Uint8Array) => data }));

const STRING_TOO_LONG = "Cannot create a string longer than 0x1fffffe8 characters";

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

function writeTar(tar_path: string, folder: string, members: Record<string, string>): void {
    for (const [name, content] of Object.entries(members)) {
        fs.mkdirSync(path.dirname(path.join(folder, name)), { recursive: true });
        fs.writeFileSync(path.join(folder, name), content);
    }
    tar.c({ sync: true, file: tar_path, cwd: folder }, Object.keys(members));
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
            fs.mkdirSync(path.join(tmp, "source", "meta"), { recursive: true });
            fs.writeFileSync(path.join(tmp, "source", "meta", "uvp6_header_m1.txt"), "cruise;ship;filename;profileid\nm1;ship;file_a;mooring_1\n");
            fs.mkdirSync(path.join(tmp, "source", "ecodata", "mooring_1"), { recursive: true });
            await writeZip(path.join(tmp, "source", "ecodata", "mooring_1", "mooring_1_Images.zip"), { "ecotaxa_mooring_1.tsv": TSV });

            const samples = await repo.listImportableSamples("source", "UVP6LP", path.join(tmp, "storage", "1"), 1);

            expect(samples.map(sample => [sample.sample_name, sample.vignette_number])).toEqual([["mooring_1", 3]]);
        });

        test("counts UVP5 TSVs larger than the text limit, zipped or in a plain work folder", async () => {
            fs.mkdirSync(path.join(tmp, "source", "meta"), { recursive: true });
            fs.writeFileSync(path.join(tmp, "source", "meta", "uvp5_header_m1.txt"), "cruise;ship;filename;profileid\nm1;ship;file_a;zipped\nm1;ship;file_b;plain\n");
            fs.mkdirSync(path.join(tmp, "source", "work", "plain"), { recursive: true });
            await writeZip(path.join(tmp, "source", "work", "zipped.zip"), { "zipped/ecotaxa_zipped.tsv": TSV });
            fs.writeFileSync(path.join(tmp, "source", "work", "plain", "ecotaxa_plain.tsv"), TSV);

            const samples = await repo.listImportableSamples("source", "UVP5HD", path.join(tmp, "storage", "1"), 1);

            expect(samples.map(sample => [sample.sample_name, sample.vignette_number])).toEqual([["zipped", 3], ["plain", 3]]);
        });

        test("does not count the vignettes of samples already imported", async () => {
            fs.mkdirSync(path.join(tmp, "source", "meta"), { recursive: true });
            fs.writeFileSync(path.join(tmp, "source", "meta", "uvp6_header_m1.txt"), "cruise;ship;filename;profileid\nm1;ship;file_a;in_db\nm1;ship;file_b;in_storage\nm1;ship;file_c;new\n");
            for (const name of ["in_db", "in_storage", "new"]) {
                fs.mkdirSync(path.join(tmp, "source", "ecodata", name), { recursive: true });
                await writeZip(path.join(tmp, "source", "ecodata", name, `${name}_Images.zip`), { [`ecotaxa_${name}.tsv`]: TSV });
            }
            fs.mkdirSync(path.join(tmp, "storage", "1", "in_storage"), { recursive: true });
            getAll.mockResolvedValue({ items: [{ sample_name: "in_db" }], total: 1 });
            const count = jest.spyOn(repo as any, "getImportableSampleImagesCount");

            const samples = await repo.listImportableSamples("source", "UVP6LP", path.join(tmp, "storage", "1"), 1);

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
});
