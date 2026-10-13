import * as fs from "fs";
import * as fsPromises from "fs/promises";
import archiver from "archiver";

// Written to a temporary file and renamed on success: a failed or interrupted export never leaves
// a truncated archive where a complete one is expected, and only its own temporary file to remove.
export async function zipFolder(folder_path: string, zip_file_path: string): Promise<void> {
    const tmp_path = `${zip_file_path}.partial`;
    await fsPromises.rm(tmp_path, { force: true });

    try {
        await new Promise<void>((resolve, reject) => {
            const output = fs.createWriteStream(tmp_path);
            const archive = archiver("zip", { zlib: { level: 9 } });
            output.on("close", () => resolve());
            output.on("error", reject);
            archive.on("error", reject);
            archive.pipe(output);
            archive.directory(folder_path, false);
            archive.finalize().catch(reject);
        });
    } catch (error) {
        await fsPromises.rm(tmp_path, { force: true }).catch(() => undefined);
        throw error;
    }

    await fsPromises.rename(tmp_path, zip_file_path);
}
