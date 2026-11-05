import fs from "fs";
import os from "os";
import path from "path";

import { SampleRepositoryImpl } from "../../../src/domain/repositories/sample-repository";
import { writeZip } from "../../helpers/archives";

const COMPLETE_INI = `[HW_CONF]
Aa=2300.000
Exp=1.136
Gain=6
Image_volume=0.530
Pixel_Size=73
Threshold=20

[ACQ_CONF]
Appendices_ratio=1.5

[sample_metadata]
latitude=63.3476
longitude=-20.2736
sampletype=P
comment=
`;

describe("checkUvp6SourceMetadataIni", () => {
    let tmp: string;
    let repo: SampleRepositoryImpl;
    const project = "uvp6_project";

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-source-ini-"));
        repo = new SampleRepositoryImpl({} as any, "storage");
        repo.base_folder = tmp;
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    async function writeSource(sample: string, ini: string): Promise<void> {
        fs.mkdirSync(path.join(tmp, project, "ecodata", sample), { recursive: true });
        await writeZip(path.join(tmp, project, "ecodata", sample, `${sample}_Particule.zip`), { "metadata.ini": ini });
    }

    test("a complete metadata.ini has nothing to report, a blank optional value is fine", async () => {
        await writeSource("s1", COMPLETE_INI);

        expect(await repo.checkUvp6SourceMetadataIni(project, "s1")).toEqual([]);
    });

    test("names every blank or absent required value, by section", async () => {
        await writeSource("s1", COMPLETE_INI.replace("Exp=1.136", "Exp=").replace("Appendices_ratio=1.5\n", "").replace("latitude=63.3476", "latitude=  "));

        expect(await repo.checkUvp6SourceMetadataIni(project, "s1")).toEqual([
            "[HW_CONF] Exp is empty",
            "[ACQ_CONF] Appendices_ratio is missing",
            "[sample_metadata] latitude is empty",
        ]);
    });

    test("a particle file that cannot be read is an error, not an empty report", async () => {
        await expect(repo.checkUvp6SourceMetadataIni(project, "absent")).rejects.toThrow();
    });
});
