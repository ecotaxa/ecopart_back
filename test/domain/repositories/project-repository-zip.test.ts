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

describe("ProjectRepositoryImpl.exportBackupedProjectToFtp", () => {
    const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
    let tmp_dir: string;

    beforeEach(() => {
        tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-ftp-export-"));
        fs.mkdirSync(path.join(tmp_dir, "fs", "1", "l0b_backup", "raw"), { recursive: true });
        fs.writeFileSync(path.join(tmp_dir, "fs", "1", "l0b_backup", "raw", "HDR1.zip"), "payload");
    });

    afterEach(() => {
        fs.rmSync(tmp_dir, { recursive: true, force: true });
    });

    test("returns the archive path inside the FTP export folder, where the archive is written", async () => {
        const repo = new ProjectRepositoryImpl({} as any, path.relative(PROJECT_ROOT, path.join(tmp_dir, "fs")), path.relative(PROJECT_ROOT, path.join(tmp_dir, "ftp")), "", "");

        const ftp_path = await repo.exportBackupedProjectToFtp({ project_id: 1 } as any, 42);

        expect(ftp_path).toMatch(/^42\/ecopart_export_backup_1_[\d_]+\.zip$/);
        expect(fs.existsSync(path.join(tmp_dir, "ftp", ftp_path))).toBe(true);
    });
});

describe("ProjectRepositoryImpl raw/ backup copy", () => {
    let base_folder: string;
    let messages: string[];
    const log = async (message: string) => { messages.push(message); };
    const write = (relative_path: string, content: string) => {
        fs.mkdirSync(path.dirname(path.join(base_folder, relative_path)), { recursive: true });
        fs.writeFileSync(path.join(base_folder, relative_path), content);
    };

    beforeEach(() => {
        base_folder = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-l0b-raw-"));
        messages = [];
        write("root/raw/r1/HDR1.dat", "raw data");
        write("root/raw/r2.zip", "zipped raw");
        write("root/raw/notes.txt", "not raw");
        fs.mkdirSync(path.join(base_folder, "backup"), { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(base_folder, { recursive: true, force: true });
    });

    test("logs each archive written with its size, the entries left out, and a total", async () => {
        const repo = new ProjectRepositoryImpl({} as any, "", "", "", "");

        await repo.copyAllL0bFolders(base_folder, "root", "backup", log);

        const zip_size = fs.statSync(path.join(base_folder, "backup", "raw", "r1.zip")).size;
        expect(messages).toEqual(expect.arrayContaining([
            "raw/notes.txt : neither a folder nor a .zip, not backed up",
            `raw/r1/ zipped as raw/r1.zip (${zip_size} B)`,
            "raw/r2.zip copied (10 B)",
            `raw/ : 2 archive(s) written (1 zipped, 1 copied), ${zip_size + 10} B, 1 not backed up`,
        ]));
        expect(messages).toHaveLength(4);
    });

    test("with skip_already_imported, logs the archives already in the backup as skipped", async () => {
        const repo = new ProjectRepositoryImpl({} as any, "", "", "", "");
        await repo.copyAllL0bFolders(base_folder, "root", "backup");
        write("root/raw/r3/HDR3.dat", "new raw data");

        await repo.copyNewL0bFolders(base_folder, "root", "backup", log);

        const zip_size = fs.statSync(path.join(base_folder, "backup", "raw", "r3.zip")).size;
        expect(messages).toEqual(expect.arrayContaining([
            "raw/r1/ : already in the backup as raw/r1.zip, skipped",
            "raw/r2.zip : already in the backup as raw/r2.zip, skipped",
            `raw/r3/ zipped as raw/r3.zip (${zip_size} B)`,
            `raw/ : 1 archive(s) written (1 zipped, 0 copied), ${zip_size} B, 2 already in the backup, 1 not backed up`,
        ]));
    });
});
