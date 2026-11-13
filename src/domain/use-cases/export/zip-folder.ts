import * as fs from "fs";
import * as fsPromises from "fs/promises";
import { finished } from "stream/promises";
import archiver from "archiver";

// Written to a temporary file and renamed on success: a failed or interrupted export never leaves
// a truncated archive where a complete one is expected, and only its own temporary file to remove.
export async function zipFolder(folder_path: string, zip_file_path: string): Promise<void> {
    const tmp_path = `${zip_file_path}.partial`;
    await fsPromises.rm(tmp_path, { force: true });

    const output = fs.createWriteStream(tmp_path);
    try {
        await new Promise<void>((resolve, reject) => {
            const archive = archiver("zip", { zlib: { level: 9 } });
            output.on("close", () => resolve());
            output.on("error", reject);
            archive.on("error", reject);
            archive.pipe(output);
            archive.directory(folder_path, false);
            archive.finalize().catch(reject);
        });
    } catch (error) {
        // Closed before the removal: a stream still opening its file would create it afterwards.
        output.destroy();
        await finished(output).catch(() => undefined);
        await fsPromises.rm(tmp_path, { force: true }).catch(() => undefined);
        throw error;
    }

    await fsPromises.rename(tmp_path, zip_file_path);
}
