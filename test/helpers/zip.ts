import yauzl from "yauzl";

// One entry of a zip archive as bytes: the text helpers of the export tests concatenate chunks
// as strings, which a binary file such as a Parquet table does not survive.
export function zipEntryBuffer(zip_path: string, entry_name: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        yauzl.open(zip_path, { lazyEntries: true }, (err, zipfile) => {
            if (err || !zipfile) return reject(err || new Error("Failed to open zip"));
            zipfile.readEntry();
            zipfile.on("entry", (entry) => {
                if (entry.fileName !== entry_name) return zipfile.readEntry();
                zipfile.openReadStream(entry, (err2, stream) => {
                    if (err2 || !stream) return reject(err2 || new Error("Failed to read entry"));
                    const chunks: Buffer[] = [];
                    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
                    stream.on("end", () => resolve(Buffer.concat(chunks)));
                    stream.on("error", reject);
                });
            });
            zipfile.on("end", () => reject(new Error(`Entry not found in archive: ${entry_name}`)));
            zipfile.on("error", reject);
        });
    });
}
