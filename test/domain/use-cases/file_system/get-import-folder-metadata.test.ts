import fs from "fs";
import os from "os";
import path from "path";
import { GetImportFolderMetadata } from "../../../../src/domain/use-cases/file_system/get-import-folder-metadata";
import { MockUserRepository } from "../../../mocks/user-mock";

const current_user = { user_id: 1 };
function usableUserRepository(): MockUserRepository {
    const repository = new MockUserRepository();
    jest.spyOn(repository, "ensureUserCanBeUsed").mockResolvedValue();
    return repository;
}

describe("Domain - Use Cases - Get Import Folder Metadata", () => {
    let importFolder: string;

    beforeEach(() => {
        importFolder = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart_import_metadata_"));
    });

    afterEach(() => {
        fs.rmSync(importFolder, { recursive: true, force: true });
    });

    test("Should keep accented characters of a Latin-1 meta header and cruise_info", async () => {
        const projectFolder = path.join(importFolder, "uvp5_sn002zd_tethys_2025");
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

        const metadata = await new GetImportFolderMetadata(importFolder, usableUserRepository()).execute(current_user, "uvp5_sn002zd_tethys_2025");

        expect(metadata.ship).toBe("Téthys_2");
        expect(metadata.cruise).toBe("campagne_été");
        expect(metadata.project_description).toBe("Campagne d'été");
    });

    test("Should read cruise and ship from the canonical meta header, not from another header next to it", async () => {
        const projectFolder = path.join(importFolder, "uvp6_sn000171hf_20230720_wcb_1_test");
        fs.mkdirSync(path.join(projectFolder, "meta"), { recursive: true });
        fs.writeFileSync(path.join(projectFolder, "meta", "uvp6_header_sn000171hf_20230720_wcb_1.txt"), "cruise;ship;filename\nwcb_1;other_ship;20230720-000000\n");
        fs.writeFileSync(path.join(projectFolder, "meta", "uvp6_header_sn000171hf_20230720_wcb_1_test.txt"), "cruise;ship;filename\nwcb_1_test;test_ship;20230720-000000\n");

        const metadata = await new GetImportFolderMetadata(importFolder, usableUserRepository()).execute(current_user, "uvp6_sn000171hf_20230720_wcb_1_test");

        expect(metadata.cruise).toBe("wcb_1_test");
        expect(metadata.ship).toBe("test_ship");
    });

    test("refuses a user who cannot be used before touching the file system", async () => {
        const repository = new MockUserRepository();
        jest.spyOn(repository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));

        await expect(new GetImportFolderMetadata(importFolder, repository).execute(current_user, "any")).rejects.toThrow("User cannot be used");
    });

    test.each(["..", "../sibling", "../" + path.basename(os.tmpdir()) + "x"])("refuses a folder outside the import root: %s", async (folder) => {
        await expect(new GetImportFolderMetadata(importFolder, usableUserRepository()).execute(current_user, folder)).rejects.toThrow("Invalid folder path");
    });
});
