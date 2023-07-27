import { CryptoWrapper } from "./crypto-wrapper"

const bcrypt = require("bcrypt")

export class BcryptAdapter implements CryptoWrapper {//implements Hasher, HashComparer 
    constructor(private readonly salt: number) { }

    async hash(plaintext: string): Promise<string> {
        return bcrypt.hash(plaintext, this.salt)
    }
    // compare password
    async compare(plaintext: string, digest: string): Promise<boolean> {
        return bcrypt.compare(plaintext, digest)
    }
}


