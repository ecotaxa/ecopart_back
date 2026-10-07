import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ProjectRepositoryImpl } from "../../../src/domain/repositories/project-repository";

// The archive is produced for a backup or an export, next to data a previous run may have left.
// These tests pin the guarantee that matters there: a failing run never destroys what was already
// on disk, and never leaves a truncated archive that a later run would take for a complete one.
describe("ProjectRepositoryImpl.zipFolder", () => {
    let base_folder: string;
    let repo: ProjectRepositoryImpl;

    const source_folder = () => path.join(base_folder, "source");
    const dest_zip = () => path.join(base_folder, "dest", "archive.zip");

    beforeEach(() => {
        base_folder = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-zip-"));
        fs.mkdirSync(source_folder(), { recursive: true });
        fs.writeFileSync(path.join(source_folder(), "content.txt"), "payload");
        fs.mkdirSync(path.dirname(dest_zip()), { recursive: true });
        repo = new ProjectRepositoryImpl({} as any, "", "", "", "");
    });

    afterEach(() => {
        fs.rmSync(base_folder, { recursive: true, force: true });
    });

    test("writes the archive and leaves no temporary file behind", async () => {
        await repo.zipFolder(source_folder(), dest_zip());

        expect(fs.existsSync(dest_zip())).toBe(true);
        expect(fs.statSync(dest_zip()).size).toBeGreaterThan(0);
        expect(fs.existsSync(`${dest_zip()}.partial`)).toBe(false);
    });

    test("a failing run leaves a previously written archive untouched", async () => {
        const previous_content = "archive written by an earlier successful run";
        fs.writeFileSync(dest_zip(), previous_content);

        // A file where a folder is expected makes archiver fail with ENOTDIR.
        const not_a_folder = path.join(base_folder, "not_a_folder");
        fs.writeFileSync(not_a_folder, "x");

        await expect(repo.zipFolder(not_a_folder, dest_zip())).rejects.toThrow();

        expect(fs.readFileSync(dest_zip(), "utf-8")).toBe(previous_content);
        expect(fs.existsSync(`${dest_zip()}.partial`)).toBe(false);
    });

    test("a temporary file left by an interrupted run does not block the next one", async () => {
        fs.writeFileSync(`${dest_zip()}.partial`, "truncated leftover");

        await repo.zipFolder(source_folder(), dest_zip());

        expect(fs.existsSync(dest_zip())).toBe(true);
        expect(fs.readFileSync(dest_zip()).subarray(0, 2).toString()).toBe("PK");
        expect(fs.existsSync(`${dest_zip()}.partial`)).toBe(false);
    });

    test("refuses to write where a directory already sits, without removing it", async () => {
        fs.mkdirSync(dest_zip(), { recursive: true });
        fs.writeFileSync(path.join(dest_zip(), "kept.txt"), "pre-existing");

        await expect(repo.zipFolder(source_folder(), dest_zip())).rejects.toThrow("Destination path is a directory");

        expect(fs.existsSync(path.join(dest_zip(), "kept.txt"))).toBe(true);
    });
});
