import fs from "fs";
import os from "os";
import path from "path";
import * as tar from "tar";
import { SampleRepositoryImpl } from "../../../src/domain/repositories/sample-repository";

// Builds a .tar.zst by hand: Node 20 has no zstd compressor, but a zstd frame made of one raw
// (stored) block is valid and fzstd decodes it.
function tarZst(entries: { name: string; content: string }[]): Buffer {
    const blocks: Buffer[] = [];
    for (const { name, content } of entries) {
        const data = Buffer.from(content);
        const header = new tar.Header({ path: name, mode: 0o644, size: data.length, mtime: new Date(0), type: "File" });
        header.encode();
        blocks.push(header.block as Buffer);
        blocks.push(Buffer.concat([data, Buffer.alloc((512 - (data.length % 512)) % 512)]));
    }
    blocks.push(Buffer.alloc(1024));
    const tarBuffer = Buffer.concat(blocks);

    const frameHeader = Buffer.from([0x28, 0xb5, 0x2f, 0xfd, 0x60, 0, 0]); // magic, single segment, 2-byte size
    frameHeader.writeUInt16LE(tarBuffer.length - 256, 5);
    const blockHeader = Buffer.alloc(3);
    blockHeader.writeUIntLE((tarBuffer.length << 3) | 1, 0, 3); // last block, raw
    return Buffer.concat([frameHeader, blockHeader, tarBuffer]);
}

describe("SampleRepository - archive extraction stays inside the destination", () => {
    let workdir: string;
    let repo: SampleRepositoryImpl;

    beforeEach(() => {
        workdir = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart_extract_"));
        repo = new SampleRepositoryImpl({} as any, "");
    });

    afterEach(() => {
        fs.rmSync(workdir, { recursive: true, force: true });
    });

    test("extracts a regular tar.zst with its top-level folder stripped", async () => {
        const archive = path.join(workdir, "s1_work.tar.zst");
        fs.writeFileSync(archive, tarZst([
            { name: "s1/s1_datfile.txt", content: "dat" },
            { name: "s1/images/img1.bmp", content: "bmp" },
        ]));
        const dest = path.join(workdir, "dest");

        await repo.extractTarZstNormalized(archive, dest);

        expect(fs.readFileSync(path.join(dest, "s1_datfile.txt"), "utf8")).toBe("dat");
        expect(fs.readFileSync(path.join(dest, "images", "img1.bmp"), "utf8")).toBe("bmp");
    });

    test("refuses an entry that climbs out of the destination folder", async () => {
        const archive = path.join(workdir, "evil_work.tar.zst");
        fs.writeFileSync(archive, tarZst([
            { name: "evil/ok.txt", content: "ok" },
            { name: "evil/../../escaped.txt", content: "pwned" },
        ]));
        const dest = path.join(workdir, "nested", "dest");

        await expect(repo.extractTarZstNormalized(archive, dest)).rejects.toThrow("Archive entry outside the extraction folder");
        expect(fs.existsSync(path.join(workdir, "escaped.txt"))).toBe(false);
    });
});
