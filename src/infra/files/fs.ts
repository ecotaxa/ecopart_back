import { FsWrapper } from "./fs-wrapper"
import fs from 'node:fs/promises';
import { ObjectEncodingOptions } from "fs";

// import bcrypt from "bcrypt"
// import { v4 as uuidv4 } from 'uuid';

export class FsAdapter implements FsWrapper {//implements readFile, writeFile
    async readFile(path: string | Buffer | URL, options: { encoding: BufferEncoding; flag?: string | number | undefined; }): Promise<string> {
        return await fs.readFile(path, options)
    }
    async writeFile(file: string | Buffer | URL, data: string | NodeJS.ArrayBufferView | Iterable<string | NodeJS.ArrayBufferView> | AsyncIterable<string | NodeJS.ArrayBufferView>, options?: ObjectEncodingOptions & { mode?: string | number | undefined; flag?: string | number | undefined; } | BufferEncoding | null): Promise<void> {
        return await fs.writeFile(file, data, options)
    }
    async appendFile(path: string | Buffer | URL, data: string | Uint8Array, options?: ObjectEncodingOptions | BufferEncoding | null): Promise<void> {
        return await fs.appendFile(path, data, options)
    }
}

