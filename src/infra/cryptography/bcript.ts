import { CryptoWrapper } from "./crypto-wrapper"
import bcrypt from "bcrypt"

export class BcryptAdapter implements CryptoWrapper {//implements Hasher, HashComparer 
    // hash password
    async hash(plaintext: string): Promise<string> {
        const salt = await bcrypt.genSalt()
        return bcrypt.hash(plaintext, salt)
    }
    // compare password
    async compare(plaintext: string, digest: string): Promise<boolean> {
        return bcrypt.compare(plaintext, digest)
    }
}


