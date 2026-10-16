export interface TokenCipherWrapper {
    // False when no key is configured: tokens are then stored and returned as they are.
    readonly enabled: boolean;
    encrypt(plaintext: string): string;
    // Returns a value that was never encrypted unchanged; throws when an encrypted value cannot be read.
    decrypt(stored: string): string;
    isEncrypted(stored: string): boolean;
}
