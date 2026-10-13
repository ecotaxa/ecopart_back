import { decodeUvpText } from "./decode-uvp-text";

// Yields the lines of a UVP text file read chunk by chunk, split like `split(/\r\n|\n|\r/)` and each
// decoded by decodeUvpText. The files that grow with the deployment (particules.csv, EcoTaxa TSV)
// can exceed the longest string V8 can build, so they are never held as one string.
export async function* readUvpTextLines(stream: AsyncIterable<Buffer>): AsyncGenerator<string> {
    let pending: Buffer[] = [];
    let after_cr = false;
    for await (const chunk of stream) {
        let start = 0;
        for (let i = 0; i < chunk.length; i++) {
            const byte = chunk[i];
            if (byte === 0x0a && after_cr) {
                // Second half of a "\r\n" whose line was already yielded at the "\r".
                after_cr = false;
                start = i + 1;
                continue;
            }
            after_cr = byte === 0x0d;
            if (byte !== 0x0a && byte !== 0x0d) continue;
            pending.push(chunk.subarray(start, i));
            const line = decodeUvpText(Buffer.concat(pending));
            pending = [];
            start = i + 1;
            yield line;
        }
        if (start < chunk.length) pending.push(chunk.subarray(start));
    }
    yield decodeUvpText(Buffer.concat(pending));
}
