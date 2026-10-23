import fs from "fs";
import path from "path";
import archiver from "archiver";
import * as tar from "tar";

export function writeZip(zip_path: string, members: Record<string, string | Buffer>): Promise<void> {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zip_path);
        const archive = archiver("zip");
        output.on("close", () => resolve());
        archive.on("error", reject);
        archive.pipe(output);
        for (const [name, content] of Object.entries(members)) archive.append(content, { name });
        archive.finalize();
    });
}

// A zstd frame of raw (stored) blocks: valid Zstandard without needing a compressor.
export function zstdRawFrame(content: Buffer): Buffer {
    const header = Buffer.alloc(13);
    header.writeUInt32LE(0xFD2FB528, 0);
    header[4] = 0xE0; // single segment, 8-byte content size
    header.writeBigUInt64LE(BigInt(content.length), 5);
    const parts = [header];
    const MAX_BLOCK = 128 * 1024;
    for (let offset = 0; offset < content.length || offset === 0; offset += MAX_BLOCK) {
        const block = content.subarray(offset, offset + MAX_BLOCK);
        const block_header = Buffer.alloc(3);
        block_header.writeUIntLE((block.length << 3) | (offset + MAX_BLOCK >= content.length ? 1 : 0), 0, 3);
        parts.push(block_header, block);
    }
    return Buffer.concat(parts);
}

// Writes `members` under `folder` and packs them, in this order, into a .tar.zst.
export function writeTar(tar_zst_path: string, folder: string, members: Record<string, string | Buffer>, preservePaths = false): void {
    for (const [name, content] of Object.entries(members)) {
        fs.mkdirSync(path.dirname(path.join(folder, name)), { recursive: true });
        fs.writeFileSync(path.join(folder, name), content);
    }
    const tar_path = `${tar_zst_path}.tar`;
    tar.c({ sync: true, file: tar_path, cwd: folder, preservePaths }, Object.keys(members));
    fs.writeFileSync(tar_zst_path, zstdRawFrame(fs.readFileSync(tar_path)));
    fs.rmSync(tar_path);
}
