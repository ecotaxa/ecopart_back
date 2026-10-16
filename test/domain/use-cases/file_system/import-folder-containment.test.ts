import fs from "fs";
import os from "os";
import path from "path";
import { ListImportFolders } from "../../../../src/domain/use-cases/file_system/list-import-folders";
import { GetImportFolderMetadata } from "../../../../src/domain/use-cases/file_system/get-import-folder-metadata";
import { MockUserRepository } from "../../../mocks/user-mock";

describe("Domain - Use Cases - Import folder containment", () => {
    let parent: string;
    let importFolder: string;

    beforeEach(() => {
        parent = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart_import_containment_"));
        importFolder = path.join(parent, "import");
        fs.mkdirSync(path.join(importFolder, "project_a"), { recursive: true });
        // A sibling whose name starts like the import folder: a plain startsWith check let it through
        fs.mkdirSync(path.join(parent, "import_other", "secret_project"), { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(parent, { recursive: true, force: true });
    });

    test("lists a folder inside the import folder", async () => {
        await expect(new ListImportFolders(importFolder).execute("")).resolves.toEqual(["project_a"]);
    });

    test.each(["../import_other", "..", "../.."])("refuses to list %s", async (folder) => {
        await expect(new ListImportFolders(importFolder).execute(folder)).rejects.toThrow("Invalid folder path");
    });

    test.each(["../import_other/secret_project", "..", "/etc"])("refuses to read the metadata of %s", async (folder) => {
        await expect(new GetImportFolderMetadata(importFolder, new MockUserRepository()).execute(folder)).rejects.toThrow("Invalid folder path");
    });
});
