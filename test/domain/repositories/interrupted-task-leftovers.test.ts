import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ProjectRepositoryImpl } from "../../../src/domain/repositories/project-repository";
import { TaskRepositoryImpl } from "../../../src/domain/repositories/task-repository";

// What a task interrupted by a server stop leaves on disk, and what the startup recovery removes:
// temporary files only, never the log of the task nor a complete file of the project.
describe("leftovers of interrupted tasks", () => {
    let base_folder: string;

    const write = (relative_path: string, content = "x") => {
        const file = path.join(base_folder, relative_path);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
    };
    const exists = (relative_path: string) => fs.existsSync(path.join(base_folder, relative_path));

    beforeEach(() => {
        base_folder = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-leftovers-"));
    });

    afterEach(() => {
        jest.restoreAllMocks();
        fs.rmSync(base_folder, { recursive: true, force: true });
    });

    describe("TaskRepositoryImpl.removeTaskWorkFiles", () => {
        test("empties the task folder except its log", async () => {
            const repo = new TaskRepositoryImpl({} as any, {} as any, "data");
            repo.base_folder = base_folder;
            write("data/tasks/12/task_log_12.log", "log");
            write("data/tasks/12/raw_export/metadata/samples.tsv");
            write("data/tasks/12/ecopart_export_raw_12.zip.partial");

            const removed = await repo.removeTaskWorkFiles(12);

            expect(removed.sort()).toEqual(["ecopart_export_raw_12.zip.partial", "raw_export"]);
            expect(exists("data/tasks/12/task_log_12.log")).toBe(true);
            expect(exists("data/tasks/12/raw_export")).toBe(false);
            expect(exists("data/tasks/12/ecopart_export_raw_12.zip.partial")).toBe(false);
        });

        test("a task without a folder : nothing to remove", async () => {
            const repo = new TaskRepositoryImpl({} as any, {} as any, "data");
            repo.base_folder = base_folder;
            await expect(repo.removeTaskWorkFiles(13)).resolves.toEqual([]);
        });
    });

    describe("ProjectRepositoryImpl.removeInterruptedWriteLeftovers", () => {
        test("removes the temporary files of unfinished writes and keeps everything else", async () => {
            const repo = new ProjectRepositoryImpl({} as any, "storage", "", "", "");
            repo.base_folder = base_folder;
            // complete files
            write("storage/5/s1/s1_Particule.zip");
            write("storage/5/s1/pivot/s1_Particule.zip");
            write("storage/5/s1/s1.ctd");
            write("storage/5/l0b_backup/raw/r1.zip");
            write("storage/5/l0b_backup/meta/header.txt");
            write("storage/5/s1/notes.tmp"); // a .tmp outside a pivot folder is not ours
            // unfinished writes
            write("storage/5/s1/pivot/s1_Particule.zip.tmp");
            write("storage/5/s1/s1.ctd.partial");
            write("storage/5/l0b_backup/raw/r2.zip.partial");
            write("storage/5/l0b_backup/meta.staging/header.txt");
            // another project is not touched
            write("storage/6/s9/s9.ctd.partial");

            const removed = await repo.removeInterruptedWriteLeftovers(5);

            expect(removed.sort()).toEqual([
                path.join("l0b_backup", "meta.staging"),
                path.join("l0b_backup", "raw", "r2.zip.partial"),
                path.join("s1", "pivot", "s1_Particule.zip.tmp"),
                path.join("s1", "s1.ctd.partial"),
            ]);
            for (const kept of ["storage/5/s1/s1_Particule.zip", "storage/5/s1/pivot/s1_Particule.zip", "storage/5/s1/s1.ctd",
                "storage/5/l0b_backup/raw/r1.zip", "storage/5/l0b_backup/meta/header.txt", "storage/5/s1/notes.tmp", "storage/6/s9/s9.ctd.partial"]) {
                expect(exists(kept)).toBe(true);
            }
        });

        test("a project without storage : nothing to remove", async () => {
            const repo = new ProjectRepositoryImpl({} as any, "storage", "", "", "");
            repo.base_folder = base_folder;
            await expect(repo.removeInterruptedWriteLeftovers(7)).resolves.toEqual([]);
        });
    });

    describe("ProjectRepositoryImpl.copyAllL0bFolders", () => {
        test("copies an already zipped raw folder without leaving a temporary file", async () => {
            const repo = new ProjectRepositoryImpl({} as any, "", "", "", "");
            write("root/raw/r1.zip", "zipped raw folder");
            fs.mkdirSync(path.join(base_folder, "backup"), { recursive: true });

            await repo.copyAllL0bFolders(base_folder, "root", "backup");

            expect(fs.readFileSync(path.join(base_folder, "backup/raw/r1.zip"), "utf8")).toBe("zipped raw folder");
            expect(exists("backup/raw/r1.zip.partial")).toBe(false);
        });

        test("a failed copy leaves neither a truncated archive nor a temporary file", async () => {
            const repo = new ProjectRepositoryImpl({} as any, "", "", "", "");
            write("root/raw/r1.zip", "zipped raw folder");
            fs.mkdirSync(path.join(base_folder, "backup"), { recursive: true });
            jest.spyOn(fs.promises, "rename").mockRejectedValueOnce(new Error("ENOSPC"));

            await expect(repo.copyAllL0bFolders(base_folder, "root", "backup")).rejects.toThrow("ENOSPC");

            expect(exists("backup/raw/r1.zip")).toBe(false);
            expect(exists("backup/raw/r1.zip.partial")).toBe(false);
        });
    });
    describe("ProjectRepositoryImpl.deleteProjectStorage", () => {
        test("removes the whole storage folder of the project and nothing else", async () => {
            const repo = new ProjectRepositoryImpl({} as any, "storage", "", "", "");
            repo.base_folder = base_folder;
            write("storage/5/s1/s1_Particule.zip");
            write("storage/5/l0b_backup/raw/r1.zip");
            write("storage/55/s1/s1_Particule.zip");

            await expect(repo.deleteProjectStorage(5)).resolves.toBe(true);

            expect(exists("storage/5")).toBe(false);
            expect(exists("storage/55/s1/s1_Particule.zip")).toBe(true);
        });

        test("a project without storage : nothing to remove", async () => {
            const repo = new ProjectRepositoryImpl({} as any, "storage", "", "", "");
            repo.base_folder = base_folder;
            await expect(repo.deleteProjectStorage(6)).resolves.toBe(false);
        });

        test("refuses anything but an integer id", async () => {
            const repo = new ProjectRepositoryImpl({} as any, "storage", "", "", "");
            repo.base_folder = base_folder;
            await expect(repo.deleteProjectStorage("../x" as any)).rejects.toThrow("Invalid project id");
        });
    });

});
