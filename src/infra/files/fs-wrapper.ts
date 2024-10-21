import { ObjectEncodingOptions } from "node:fs";

export interface FsWrapper {
    readFile(path: string | Buffer | URL, options: ({
        encoding: BufferEncoding;
        flag?: string | number | undefined;
    })): Promise<string>

    writeFile(file: string | Buffer | URL, data: string | NodeJS.ArrayBufferView | Iterable<string | NodeJS.ArrayBufferView> | AsyncIterable<string | NodeJS.ArrayBufferView>, options?: (ObjectEncodingOptions & {
        mode?: string | number | undefined;
        flag?: string | number | undefined;
    }) | BufferEncoding | null): Promise<void>
    appendFile(path: string | Buffer | URL, data: string | Uint8Array, options?: (ObjectEncodingOptions) | BufferEncoding | null): Promise<void>

}