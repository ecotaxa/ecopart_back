import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { zipFolder } from "../../../../src/domain/use-cases/export/zip-folder";

describe("zipFolder", () => {
    let base_folder: string;

    const dest_zip = () => path.join(base_folder, "archive.zip");

    beforeEach(() => {
        base_folder = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-export-zip-"));
    });

    afterEach(() => {
        fs.rmSync(base_folder, { recursive: true, force: true });
    });

    test("a failing run removes its temporary file even when that file gets created after the failure", async () => {
        // The file is opened asynchronously: on a loaded machine, this happens after the failure.
        const real_fs = jest.requireActual("fs");
        const real_open = real_fs.open;
        const open_spy = jest.spyOn(real_fs, "open").mockImplementation((...args: any[]) => {
            if (String(args[0]).endsWith(".partial")) setTimeout(() => real_open(...args), 50);
            else real_open(...args);
        });
        const not_a_folder = path.join(base_folder, "not_a_folder");
        fs.writeFileSync(not_a_folder, "x");

        try {
            await expect(zipFolder(not_a_folder, dest_zip())).rejects.toThrow();
            // Long enough for a file still being opened to show up
            await new Promise((resolve) => setTimeout(resolve, 150));
        } finally {
            open_spy.mockRestore();
        }

        expect(fs.existsSync(`${dest_zip()}.partial`)).toBe(false);
    });

    test("writes the archive and leaves no temporary file behind", async () => {
        const source_folder = path.join(base_folder, "source");
        fs.mkdirSync(source_folder);
        fs.writeFileSync(path.join(source_folder, "content.txt"), "payload");

        await zipFolder(source_folder, dest_zip());

        expect(fs.readFileSync(dest_zip()).subarray(0, 2).toString()).toBe("PK");
        expect(fs.existsSync(`${dest_zip()}.partial`)).toBe(false);
    });
});
