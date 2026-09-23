import fs from "fs";
import os from "os";
import path from "path";
import { GetImportFolderMetadata } from "../../../../src/domain/use-cases/file_system/get-import-folder-metadata";
import { MockUserRepository } from "../../../mocks/user-mock";

describe("Domain - Use Cases - Get Import Folder Metadata", () => {
    let importFolder: string;

    beforeEach(() => {
        importFolder = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart_import_metadata_"));
    });

    afterEach(() => {
        fs.rmSync(importFolder, { recursive: true, force: true });
    });

    test("Should keep accented characters of a Latin-1 meta header and cruise_info", async () => {
        const projectFolder = path.join(importFolder, "tethys_2025");
        fs.mkdirSync(path.join(projectFolder, "meta"), { recursive: true });
        fs.mkdirSync(path.join(projectFolder, "config"), { recursive: true });
        fs.writeFileSync(
            path.join(projectFolder, "meta", "uvp5_header_sn002zd_tethys_2025.txt"),
            Buffer.from("cruise;ship;filename\ncampagne_été;Téthys_2;20250101-000000\n", "latin1")
        );
        fs.writeFileSync(
            path.join(projectFolder, "config", "cruise_info.txt"),
            Buffer.from("[cruise]\nacron=TETHYS\ndescription=Campagne d'été\n", "latin1")
        );

        const metadata = await new GetImportFolderMetadata(importFolder, new MockUserRepository()).execute("tethys_2025");

        expect(metadata.ship).toBe("Téthys_2");
        expect(metadata.cruise).toBe("campagne_été");
        expect(metadata.project_description).toBe("Campagne d'été");
    });
});
