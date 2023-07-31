import { CryptoWrapper } from "./crypto-wrapper"
import bcrypt from "bcrypt"

export class BcryptAdapter implements CryptoWrapper {//implements Hasher, HashComparer 
    constructor(private readonly salt: number) { }
    // hash password
    async hash(plaintext: string): Promise<string> {
        return bcrypt.hash(plaintext, this.salt)
    }
    // compare password
    async compare(plaintext: string, digest: string): Promise<boolean> {
        return bcrypt.compare(plaintext, digest)
    }
}


