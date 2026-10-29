import fs from "fs";
import os from "os";
import path from "path";

import { SampleRepositoryImpl } from "../../../src/domain/repositories/sample-repository";
import { writeTar, writeZip } from "../../helpers/archives";

const COMPLETE_WORK = {
    "s1/s1_datfile.txt": "datfile",
    "s1/HDR20120521121633.txt": "hdr",
    "s1/s1.bru": "bru",
    "s1/images/s1_1.png": "image",
};

describe("Import pre-checks in the source folder", () => {
    let tmp: string;
    let repo: SampleRepositoryImpl;
    const getAll = jest.fn();

    beforeEach(() => {
        jest.restoreAllMocks();
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-import-precheck-"));
        fs.mkdirSync(path.join(tmp, "storage", "1"), { recursive: true });
        getAll.mockReset().mockResolvedValue({ items: [], total: 0 });
        repo = new SampleRepositoryImpl({ getAll } as any, "storage");
        repo.base_folder = tmp;
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    describe("checkUvp5WorkFiles", () => {
        const work = () => path.join(tmp, "uvp5_m1", "work");

        beforeEach(() => {
            fs.mkdirSync(work(), { recursive: true });
        });

        test.each([
            ["tar.zst", "work/s1.tar.zst"],
            ["zip", "work/s1.zip"],
            ["folder", "work/s1"],
        ])("a complete %s work entry lacks nothing", async (form, work_source) => {
            if (form === "tar.zst") writeTar(path.join(work(), "s1.tar.zst"), path.join(tmp, "content"), COMPLETE_WORK);
            if (form === "zip") await writeZip(path.join(work(), "s1.zip"), COMPLETE_WORK);
            if (form === "folder") {
                for (const [name, content] of Object.entries(COMPLETE_WORK)) {
                    fs.mkdirSync(path.dirname(path.join(work(), name)), { recursive: true });
                    fs.writeFileSync(path.join(work(), name), content);
                }
            }

            const check = await repo.checkUvp5WorkFiles("uvp5_m1", "s1");

            expect(check.work_source).toBe(work_source);
            expect(check.missing).toEqual([]);
        });

        test("names the files the import reads that the work entry lacks", async () => {
            writeTar(path.join(work(), "s1.tar.zst"), path.join(tmp, "content"), { "s1/s1_datfile.txt": "datfile", "s1/images/s1_1.png": "image" });

            await expect(repo.checkUvp5WorkFiles("uvp5_m1", "s1")).resolves.toEqual({ work_source: "work/s1.tar.zst", files_count: 2, missing: ["HDR*.txt", "s1.bru"] });
        });

        test("never looks outside the work entry: a HDR in raw/ or a .bru in results/ does not count", async () => {
            await writeZip(path.join(work(), "s1.zip"), { "s1/s1_datfile.txt": "datfile" });
            fs.mkdirSync(path.join(tmp, "uvp5_m1", "raw", "HDR20120521121633"), { recursive: true });
            fs.writeFileSync(path.join(tmp, "uvp5_m1", "raw", "HDR20120521121633", "HDR20120521121633.hdr"), "hdr");
            fs.mkdirSync(path.join(tmp, "uvp5_m1", "results"), { recursive: true });
            fs.writeFileSync(path.join(tmp, "uvp5_m1", "results", "s1.bru"), "bru");

            expect((await repo.checkUvp5WorkFiles("uvp5_m1", "s1")).missing).toEqual(["HDR*.txt", "s1.bru"]);
        });

        test("looks at the files where the copy puts them: macOS metadata does not count, a file outside the common top folder keeps the others in theirs", async () => {
            await writeZip(path.join(work(), "s1.zip"), {
                ...COMPLETE_WORK,
                "__MACOSX/s1/._s1.bru": "junk",
                "notes.txt": "a file next to the sample folder",
            });

            expect((await repo.checkUvp5WorkFiles("uvp5_m1", "s1")).missing).toEqual(["s1_datfile.txt", "HDR*.txt", "s1.bru"]);
        });

        test("does not take a macOS resource fork for the file itself", async () => {
            await writeZip(path.join(work(), "s1.zip"), { "s1/s1_datfile.txt": "datfile", "s1/HDR20120521121633.txt": "hdr", "s1/._s1.bru": "junk" });

            expect((await repo.checkUvp5WorkFiles("uvp5_m1", "s1")).missing).toEqual(["s1.bru"]);
        });

        test("reads the work entry the copy would take: the tar.zst before the zip and the folder", async () => {
            writeTar(path.join(work(), "s1.tar.zst"), path.join(tmp, "content"), { "s1/s1_datfile.txt": "datfile" });
            await writeZip(path.join(work(), "s1.zip"), COMPLETE_WORK);

            await expect(repo.checkUvp5WorkFiles("uvp5_m1", "s1")).resolves.toEqual({ work_source: "work/s1.tar.zst", files_count: 1, missing: ["HDR*.txt", "s1.bru"] });
        });

        test("rejects on a corrupted archive", async () => {
            fs.writeFileSync(path.join(work(), "s1.tar.zst"), Buffer.from("not zstandard data"));

            await expect(repo.checkUvp5WorkFiles("uvp5_m1", "s1")).rejects.toThrow();
        });
    });

    describe("qc_lvl1 requires an operator email", () => {
        const UVP5_HEADER = "cruise;ship;filename;profileid\nm1;ship;file_a;s1\nm1;ship;file_b;s2\nm1;ship;file_c;absent\n";
        const list = (project: string, instrument_model: string, inspected?: string[]) =>
            repo.listImportableSamples(project, instrument_model, path.join(tmp, "storage", "1"), 1, inspected);
        const qc = (samples: { sample_name: string, qc_lvl1: boolean, qc_lvl1_comment: string }[]) =>
            samples.map(sample => [sample.sample_name, sample.qc_lvl1, sample.qc_lvl1_comment]);

        describe("UVP5: the config files shared by every sample", () => {
            const CONFIG: Record<string, string> = {
                "config/cruise_info.txt": "[General]\nop_name=lars stemmann\nop_email=lars.stemmann@sorbonne-universite.fr\n",
                "config/uvp5_settings/uvp5_configuration_data.txt": "[config]\npixel= 0.093\nxsize= 2048\nysize= 2048\n",
                "config/process_install_config.txt": "pixel=  0.088\ngamma= 1\n",
            };
            // `config` replaces some files of CONFIG, null leaves one out.
            const writeUvp5Project = (config: Record<string, string | null> = {}) => {
                fs.mkdirSync(path.join(tmp, "uvp5_m1", "meta"), { recursive: true });
                fs.writeFileSync(path.join(tmp, "uvp5_m1", "meta", "uvp5_header_m1.txt"), UVP5_HEADER);
                for (const name of ["s1", "s2"]) fs.mkdirSync(path.join(tmp, "uvp5_m1", "work", name), { recursive: true });
                for (const [file, content] of Object.entries({ ...CONFIG, ...config })) {
                    if (content === null) continue;
                    fs.mkdirSync(path.dirname(path.join(tmp, "uvp5_m1", file)), { recursive: true });
                    fs.writeFileSync(path.join(tmp, "uvp5_m1", file), content);
                }
            };
            const failingEverySample = (comment: string) => [
                ["s1", false, comment],
                ["s2", false, comment],
                ["absent", false, "Sample not found in work folder"],
            ];

            test("passes with every config file and the values the import requires", async () => {
                writeUvp5Project();

                expect(qc(await list("uvp5_m1", "UVP5HD"))).toEqual([
                    ["s1", true, ""],
                    ["s2", true, ""],
                    ["absent", false, "Sample not found in work folder"],
                ]);
            });

            test.each([
                ["without an op_email line", "[General]\nop_name=lars stemmann\n"],
                ["with an empty op_email", "[General]\nop_email=\n"],
                ["with a blank op_email", "[General]\nop_email=   \n"],
            ])("fails every sample %s", async (_case, cruise_info) => {
                writeUvp5Project({ "config/cruise_info.txt": cruise_info });

                expect(qc(await list("uvp5_m1", "UVP5HD"))).toEqual(failingEverySample("no op_email in config/cruise_info.txt"));
            });

            test.each([
                ["an empty uvp5_configuration_data.txt", ""],
                ["a blank pixel", "[config]\npixel=\nxsize= 2048\n"],
            ])("fails every sample with %s: the pixel size is required", async (_case, configuration_data) => {
                writeUvp5Project({ "config/uvp5_settings/uvp5_configuration_data.txt": configuration_data });

                expect(qc(await list("uvp5_m1", "UVP5HD"))).toEqual(failingEverySample("no pixel in config/uvp5_settings/uvp5_configuration_data.txt"));
            });

            test("fails every sample, even those not inspected, naming every config file missing", async () => {
                writeUvp5Project({ "config/cruise_info.txt": null, "config/process_install_config.txt": null });

                expect(qc(await list("uvp5_m1", "UVP5HD", []))).toEqual(failingEverySample("config/cruise_info.txt not found, config/process_install_config.txt not found"));
            });
        });

        describe("UVP6: HW_CONF.Operator_email of each sample's metadata.ini", () => {
            const particule_zip = (name: string) => path.join(tmp, "uvp6_m1", "ecodata", name, `${name}_Particule.zip`);
            const metadataIni = (hw_conf: string) => `[sample_metadata]\nprofileid=x\n[HW_CONF]\n${hw_conf}\n[ACQ_CONF]\n`;
            const writeUvp6Sample = (name: string, hw_conf: string | null) => {
                fs.mkdirSync(path.join(tmp, "uvp6_m1", "ecodata", name), { recursive: true });
                return hw_conf === null ? Promise.resolve() : writeZip(particule_zip(name), { "metadata.ini": metadataIni(hw_conf) });
            };

            beforeEach(() => {
                fs.mkdirSync(path.join(tmp, "uvp6_m1", "meta"), { recursive: true });
                fs.writeFileSync(path.join(tmp, "uvp6_m1", "meta", "uvp6_header_m1.txt"), "cruise;ship;filename;profileid\nm1;ship;file_a;s1\nm1;ship;file_b;s2\nm1;ship;file_c;s3\n");
            });

            test("fails the samples without an operator email, empty or absent, and those whose metadata.ini cannot be read", async () => {
                await writeUvp6Sample("s1", "Operator_email=marc.picheral@imev-mer.fr");
                await writeUvp6Sample("s2", "Operator_email=");
                await writeUvp6Sample("s3", null);

                expect(qc(await list("uvp6_m1", "UVP6LP"))).toEqual([
                    ["s1", true, ""],
                    ["s2", false, "no Operator_email in the HW_CONF section of metadata.ini (ecodata/s2/s2_Particule.zip)"],
                    ["s3", false, "ecodata/s3/s3_Particule.zip not found"],
                ]);
            });

            test("checks only the samples inspected", async () => {
                await writeUvp6Sample("s1", "Gain=6");
                await writeUvp6Sample("s2", "Operator_email=marc.picheral@imev-mer.fr");
                await writeUvp6Sample("s3", "Gain=6");

                expect(qc(await list("uvp6_m1", "UVP6LP", ["s2", "s3"]))).toEqual([
                    ["s1", true, ""],
                    ["s2", true, ""],
                    ["s3", false, "no Operator_email in the HW_CONF section of metadata.ini (ecodata/s3/s3_Particule.zip)"],
                ]);
            });

            test("reads a metadata.ini again only once its archive has changed", async () => {
                await writeUvp6Sample("s1", "Operator_email=marc.picheral@imev-mer.fr");
                const read = jest.spyOn(repo, "getSampleFromMetadataIni");

                await list("uvp6_m1", "UVP6LP", ["s1"]);
                await list("uvp6_m1", "UVP6LP", ["s1"]);
                expect(read).toBeCalledTimes(1);

                // The mtime has a coarse resolution on some file systems: the size alone tells here.
                await writeUvp6Sample("s1", "Gain=6");
                expect(qc(await list("uvp6_m1", "UVP6LP", ["s1"]))[0]).toEqual(["s1", false, "no Operator_email in the HW_CONF section of metadata.ini (ecodata/s1/s1_Particule.zip)"]);
                expect(read).toBeCalledTimes(2);
            });
        });

        describe("a profileid on several lines of the meta header", () => {
            const writeUvp6Project = async (header: string, samples: Record<string, string>) => {
                fs.mkdirSync(path.join(tmp, "uvp6_m1", "meta"), { recursive: true });
                fs.writeFileSync(path.join(tmp, "uvp6_m1", "meta", "uvp6_header_m1.txt"), header);
                for (const [name, hw_conf] of Object.entries(samples)) {
                    fs.mkdirSync(path.join(tmp, "uvp6_m1", "ecodata", name), { recursive: true });
                    await writeZip(path.join(tmp, "uvp6_m1", "ecodata", name, `${name}_Particule.zip`), { "metadata.ini": `[sample_metadata]\nprofileid=${name}\n[HW_CONF]\n${hw_conf}\n[ACQ_CONF]\n` });
                }
            };
            const EMAIL = "Operator_email=marc.picheral@imev-mer.fr";

            test("is listed once, importable when its lines are identical and not importable when they differ", async () => {
                await writeUvp6Project(
                    "cruise;ship;filename;profileid\nm1;ship;file_a;s1\nm1;ship;file_b;s2\nm1;ship;file_a;s1\nm1;ship;file_c;s2\nm1;ship;file_b;s2\nm1;ship;file_d;s3\n",
                    { s1: EMAIL, s2: EMAIL, s3: EMAIL },
                );

                expect(qc(await list("uvp6_m1", "UVP6LP"))).toEqual([
                    ["s1", true, ""],
                    ["s2", false, "listed on 3 lines of the meta header, with different values"],
                    ["s3", true, ""],
                ]);
            });

            test("the reason comes before the other problems of the sample", async () => {
                await writeUvp6Project("cruise;ship;filename;profileid\nm1;ship;file_a;s1\nm1;ship;file_b;s1\n", { s1: "Gain=6" });

                expect(qc(await list("uvp6_m1", "UVP6LP"))).toEqual([
                    ["s1", false, "listed on 2 lines of the meta header, with different values, no Operator_email in the HW_CONF section of metadata.ini (ecodata/s1/s1_Particule.zip)"],
                ]);
            });

            test("a sample already imported is left out, whatever its lines", async () => {
                await writeUvp6Project("cruise;ship;filename;profileid\nm1;ship;file_a;s1\nm1;ship;file_b;s1\nm1;ship;file_c;s2\n", { s1: EMAIL, s2: EMAIL });
                getAll.mockResolvedValue({ items: [{ sample_name: "s1" }], total: 1 });

                expect(qc(await list("uvp6_m1", "UVP6LP"))).toEqual([["s2", true, ""]]);
            });
        });
    });
});
