import { CryptoWrapper } from "./crypto-wrapper"
import bcrypt from "bcrypt"
import { v4 as uuidv4 } from 'uuid';

export class BcryptAdapter implements CryptoWrapper {//implements Hasher, HashComparer 
    // hash password
    async hash(plaintext: string): Promise<string> {
        const salt = await bcrypt.genSalt(12)
        return bcrypt.hash(plaintext, salt)
    }
    // compare password
    async compare(plaintext: string, digest: string): Promise<boolean> {
        return bcrypt.compare(plaintext, digest)
    }
    //generate unique id
    generate_uuid(): string {
        return uuidv4();
    }
}


