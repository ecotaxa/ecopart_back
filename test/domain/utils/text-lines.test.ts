import { Readable } from "stream";

import { readUvpTextLines } from "../../../src/domain/utils/text-lines";

async function lines(chunks: Buffer[]): Promise<string[]> {
    const result: string[] = [];
    for await (const line of readUvpTextLines(Readable.from(chunks))) result.push(line);
    return result;
}

function oneByteChunks(bytes: Buffer): Buffer[] {
    return Array.from(bytes, (byte) => Buffer.from([byte]));
}

describe("readUvpTextLines", () => {
    const inputs = ["", "a", "a\n", "a\nb", "a\r\nb\r\n", "a\rb\r", "a\r\rb", "a\n\r\nb", "\r\n\n", "h\tx\r\n  \r\ny"];

    test.each(inputs)("splits %j like split(/\\r\\n|\\n|\\r/), whatever the chunking", async (input) => {
        const bytes = Buffer.from(input);
        const expected = input.split(/\r\n|\n|\r/);

        expect(await lines([bytes])).toEqual(expected);
        expect(await lines(oneByteChunks(bytes))).toEqual(expected);
    });

    test("decodes a UTF-8 character split across two chunks", async () => {
        const bytes = Buffer.from("Téthys\nb", "utf8");
        const e_acute = bytes.indexOf(0xc3);

        expect(await lines([bytes.subarray(0, e_acute + 1), bytes.subarray(e_acute + 1)])).toEqual(["Téthys", "b"]);
    });

    test("falls back to Latin-1 for a line that is not valid UTF-8", async () => {
        expect(await lines([Buffer.from("Téthys\r\nb", "latin1")])).toEqual(["Téthys", "b"]);
    });
});
