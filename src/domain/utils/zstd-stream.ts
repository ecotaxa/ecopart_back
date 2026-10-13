import { Transform } from "stream";
import * as fzstd from "fzstd";

// Zstandard decompression as a stream: a .tar.zst holding a sample's images reaches several GB and
// must never be decompressed whole in memory.
export function createZstdDecompressStream(): Transform {
    const stream = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            try {
                decompressor.push(chunk);
                callback();
            } catch (error) {
                callback(error as Error);
            }
        },
        flush(callback) {
            try {
                decompressor.push(new Uint8Array(0), true);
                callback();
            } catch (error) {
                callback(error as Error);
            }
        },
    });
    // fzstd may hand out a view on its internal window: copy it before passing it on.
    const decompressor = new fzstd.Decompress((data) => { stream.push(Buffer.from(data)); });
    return stream;
}
