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

const COLUMNS = "cruise;ship;filename;profileid;bottomdepth;ctdrosettefilename;latitude;longitude;firstimage;volimage;aa;exp;dn;winddir;windspeed;seastate;nebuloussness;comment;endimg;yoyo;stationid";
const row = (profileid: string, firstimage: number) =>
    `sn201_hot;europe;20120520080213;${profileid};82;${profileid};43.4111;7.1901;${firstimage};0.48;0.0014;1.397;D;300;6;1;8;comment;871;N;st_${profileid}`;
const header = (...rows: string[]) => [COLUMNS, ...rows].join("\n") + "\n";

describe("Meta header choice", () => {
    let tmp: string;
    let repo: SampleRepositoryImpl;
    const getAll = jest.fn();

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-meta-header-"));
        fs.mkdirSync(path.join(tmp, "storage", "1"), { recursive: true });
        getAll.mockReset().mockResolvedValue({ items: [], total: 0 });
        repo = new SampleRepositoryImpl({ getAll } as any, "storage");
        repo.base_folder = tmp;
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    // A UVP6 sample gets a metadata.ini with its operator email, which qc_lvl1 requires.
    async function writeSourceProject(project: string, headers: Record<string, string>, data_folder: string, samples: string[]): Promise<void> {
        fs.mkdirSync(path.join(tmp, project, "meta"), { recursive: true });
        for (const [name, content] of Object.entries(headers)) fs.writeFileSync(path.join(tmp, project, "meta", name), content);
        for (const sample of samples) {
            fs.mkdirSync(path.join(tmp, project, data_folder, sample), { recursive: true });
            if (data_folder === "ecodata") {
                await writeZip(path.join(tmp, project, data_folder, sample, `${sample}_Particule.zip`), { "metadata.ini": "[sample_metadata]\n[HW_CONF]\nOperator_email=op@example.org\n[ACQ_CONF]\n" });
            }
        }
    }

    describe("listImportableSamples", () => {
        test("lists the samples of the canonical header, not those of another deployment's header next to it", async () => {
            const project = "uvp6_sn000171hf_20230720_wcb_1_test";
            await writeSourceProject(project, {
                "uvp6_header_sn000171hf_20230720_wcb_1.txt": header(row("wcb_1_001", 1), row("wcb_1_002", 1)),
                "uvp6_header_sn000171hf_20230720_wcb_1_test.txt": header(row("wcb_1_test_001", 1)),
            }, "ecodata", ["wcb_1_test_001"]);

            const samples = await repo.listImportableSamples(project, "UVP6LP", path.join(tmp, "storage", "1"), 1);

            expect(samples.map(sample => [sample.sample_name, sample.qc_lvl1])).toEqual([["wcb_1_test_001", true]]);
        });

        test("lists the samples of the canonical header, not those of its copies", async () => {
            const project = "uvp6_sn000104lp_2020_WMO5906623_recovery_profiles_full";
            await writeSourceProject(project, {
                "uvp6_header_sn000104lp_2020_WMO5906623_recovery_profiles_full - Copy.txt": header(row("0000a", 1), row("0000p", 1)),
                "uvp6_header_sn000104lp_2020_WMO5906623_recovery_profiles_full_copy20250306.txt": header(row("0000a", 1)),
                "uvp6_header_sn000104lp_2020_WMO5906623_recovery_profiles_full.txt": header(row("0000a", 1), row("9999a", 2)),
            }, "ecodata", ["0000a", "9999a"]);

            const samples = await repo.listImportableSamples(project, "UVP6LP", path.join(tmp, "storage", "1"), 1);

            expect(samples.map(sample => sample.sample_name)).toEqual(["0000a", "9999a"]);
        });

        test("fails, naming the expected file, when meta/ has no canonical header", async () => {
            const project = "uvp6_sn000007lp_2019_seaglider_test_cscs";
            await writeSourceProject(project, {
                "uvp6_header_sn000007lp_2019_seaglider_test_cscs - Copie.txt": header(row("gid_09down", 1)),
            }, "ecodata", ["gid_09"]);

            await expect(repo.listImportableSamples(project, "UVP6LP", path.join(tmp, "storage", "1"), 1))
                .rejects.toThrow("Meta header file not found: meta/uvp6_header_sn000007lp_2019_seaglider_test_cscs.txt");
        });
    });

    describe("UVP5 sample header, from the sample's _meta_conf.zip", () => {
        const sample_folder = () => path.join(tmp, "storage", "1", "s1");
        const writeMetaConf = (headers: Record<string, string>) => {
            fs.mkdirSync(sample_folder(), { recursive: true });
            const members = Object.fromEntries(Object.entries(headers).map(([name, content]) => [`meta/${name}`, content]));
            return writeZip(path.join(sample_folder(), "s1_meta_conf.zip"), members);
        };
        const read = (root_folder_path: string) => repo.getSampleFromMetaHeader(path.join(tmp, "storage", "1"), "s1", root_folder_path);

        test("reads the canonical header of the project folder, not a copy listing the sample too", async () => {
            await writeMetaConf({
                "uvp5_header_sn201_hot - Copy.txt": header(row("s1", 1)),
                "uvp5_header_sn201_hot.txt": header(row("s1", 2)),
                "Archive/uvp5_header_sn201_hot.txt": header(row("s1", 3)),
            });

            const sample = await read("remote/uvp5_sn201_hot");

            expect(sample.filter_first_image).toBe("2");
            expect(sample.instrument_serial_number).toBe("201");
        });

        test("fails, naming the expected file, when the zip has no canonical header", async () => {
            await writeMetaConf({ "uvp5_header_sn201_hot - Copy.txt": header(row("s1", 1)) });

            await expect(read("uvp5_sn201_hot")).rejects.toThrow("Meta header file not found: meta/uvp5_header_sn201_hot.txt");
        });
    });

    test("the QC preview of a UVP5 source sample reads the canonical header", async () => {
        const project = "uvp5_sn201_hot";
        await writeSourceProject(project, {
            "uvp5_header_sn201_hot - Copy.txt": header(row("s1", 1)),
            "uvp5_header_sn201_hot.txt": header(row("s1", 2)),
        }, "work", ["s1"]);

        const metadata = await repo.getSourceFilterMetadata(project, "s1", "UVP5HD");

        expect(metadata.filter_first_image).toBe("2");
    });
});
