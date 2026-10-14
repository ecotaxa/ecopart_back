import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { TokenCipherWrapper } from './token-cipher-wrapper';

const PREFIX = 'enc:v1:';
const IV_BYTES = 12;
const TAG_BYTES = 16;

// Encrypts EcoTaxa tokens at rest with AES-256-GCM, so that a copy of the database (backup, local
// copy, SQL read) does not hand out working EcoTaxa credentials. Without a key it keeps the previous
// behaviour, tokens in clear, so that deploying without the variable changes nothing.
export class AesGcmTokenCipher implements TokenCipherWrapper {
    private readonly key: Buffer | null;

    constructor(base64Key: string) {
        if (!base64Key) {
            this.key = null;
            return;
        }
        const key = Buffer.from(base64Key, 'base64');
        if (key.length !== 32) {
            throw new Error('ECOTAXA_TOKEN_ENCRYPTION_KEY must be 32 bytes encoded in base64 (openssl rand -base64 32)');
        }
        this.key = key;
    }

    get enabled(): boolean {
        return this.key !== null;
    }

    isEncrypted(stored: string): boolean {
        return stored.startsWith(PREFIX);
    }

    encrypt(plaintext: string): string {
        if (!this.key) return plaintext;
        const iv = randomBytes(IV_BYTES);
        const cipher = createCipheriv('aes-256-gcm', this.key, iv);
        const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
    }

    decrypt(stored: string): string {
        // Saved before encryption was configured: read as it is, encrypted at the next startup.
        if (!this.isEncrypted(stored)) return stored;
        if (!this.key) throw new Error('EcoTaxa token is encrypted but ECOTAXA_TOKEN_ENCRYPTION_KEY is not set');
        const data = Buffer.from(stored.slice(PREFIX.length), 'base64');
        const decipher = createDecipheriv('aes-256-gcm', this.key, data.subarray(0, IV_BYTES));
        decipher.setAuthTag(data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
        return Buffer.concat([decipher.update(data.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
    }
}
