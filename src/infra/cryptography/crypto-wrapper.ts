export interface CryptoWrapper {
    hash(plaintext: string): Promise<string>;
    compare(plaintext: string, digest: string): Promise<boolean>;
    generate_uuid(): string;
}