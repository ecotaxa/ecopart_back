import fs from "fs";
import os from "os";
import path from "path";
import { ListImportFolders } from "../../../../src/domain/use-cases/file_system/list-import-folders";
import { resolveInsideImportFolder } from "../../../../src/domain/use-cases/file_system/import-folder-path";
import { MockUserRepository } from "../../../mocks/user-mock";

const current_user = { user_id: 1 };

describe("Domain - Use Cases - List Import Folders", () => {
    let importFolder: string;
    let repository: MockUserRepository;

    beforeEach(() => {
        importFolder = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart_import_folders_"));
        fs.mkdirSync(path.join(importFolder, "uvp6_b"));
        fs.mkdirSync(path.join(importFolder, "uvp5_a", "raw"), { recursive: true });
        fs.writeFileSync(path.join(importFolder, "notes.txt"), "");
        // A sibling of the import root whose name starts with the root's own name
        fs.mkdirSync(importFolder + "_old");
        repository = new MockUserRepository();
        jest.spyOn(repository, "ensureUserCanBeUsed").mockResolvedValue();
    });

    afterEach(() => {
        fs.rmSync(importFolder, { recursive: true, force: true });
        fs.rmSync(importFolder + "_old", { recursive: true, force: true });
    });

    test("lists the folders under the import root, sorted, files left out", async () => {
        await expect(new ListImportFolders(importFolder, repository).execute(current_user, "")).resolves.toEqual(["uvp5_a", "uvp6_b"]);
        await expect(new ListImportFolders(importFolder, repository).execute(current_user, "uvp5_a")).resolves.toEqual([path.join("uvp5_a", "raw")]);
        expect(repository.ensureUserCanBeUsed).toBeCalledWith(1);
    });

    test("refuses a user who cannot be used before reading anything", async () => {
        jest.spyOn(repository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));
        await expect(new ListImportFolders(importFolder, repository).execute(current_user, "")).rejects.toThrow("User cannot be used");
    });

    test.each(["..", "../other", "/etc"])("refuses a folder outside the import root: %s", async (folder) => {
        await expect(new ListImportFolders(importFolder, repository).execute(current_user, folder)).rejects.toThrow("Invalid folder path");
    });

    test("a sibling whose name starts with the root's name is outside the root", () => {
        expect(() => resolveInsideImportFolder(importFolder, "../" + path.basename(importFolder) + "_old")).toThrow("Invalid folder path");
        expect(resolveInsideImportFolder(importFolder, "")).toBe(path.resolve(importFolder));
        expect(resolveInsideImportFolder(importFolder, "uvp5_a")).toBe(path.resolve(importFolder, "uvp5_a"));
    });
});
