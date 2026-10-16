import { randomBytes } from "crypto";
import { AesGcmTokenCipher } from "../../../src/infra/cryptography/aes-gcm-token-cipher";

describe("AesGcmTokenCipher", () => {
    const key = randomBytes(32).toString("base64");
    const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.ecotaxa-token-example";

    test("encrypts with a random IV and decrypts back", () => {
        const cipher = new AesGcmTokenCipher(key);
        const first = cipher.encrypt(token);
        const second = cipher.encrypt(token);

        expect(cipher.enabled).toBe(true);
        expect(first.startsWith("enc:v1:")).toBe(true);
        expect(first).not.toContain(token);
        expect(first).not.toEqual(second);
        expect(cipher.decrypt(first)).toBe(token);
        expect(cipher.decrypt(second)).toBe(token);
    });

    test("returns a token saved in clear unchanged", () => {
        expect(new AesGcmTokenCipher(key).decrypt(token)).toBe(token);
    });

    test("refuses a modified value", () => {
        const cipher = new AesGcmTokenCipher(key);
        const stored = cipher.encrypt(token);
        const raw = Buffer.from(stored.slice("enc:v1:".length), "base64");
        raw[raw.length - 1] ^= 0x01;
        expect(() => cipher.decrypt("enc:v1:" + raw.toString("base64"))).toThrow();
    });

    test("refuses a value encrypted with another key", () => {
        const stored = new AesGcmTokenCipher(key).encrypt(token);
        expect(() => new AesGcmTokenCipher(randomBytes(32).toString("base64")).decrypt(stored)).toThrow();
    });

    test("without a key, stores in clear and cannot read encrypted values", () => {
        const cipher = new AesGcmTokenCipher("");
        expect(cipher.enabled).toBe(false);
        expect(cipher.encrypt(token)).toBe(token);
        expect(cipher.decrypt(token)).toBe(token);
        expect(() => cipher.decrypt(new AesGcmTokenCipher(key).encrypt(token))).toThrow("ECOTAXA_TOKEN_ENCRYPTION_KEY is not set");
    });

    test.each(["short", randomBytes(16).toString("base64"), randomBytes(48).toString("base64")])("refuses a key that is not 32 bytes: %s", (bad) => {
        expect(() => new AesGcmTokenCipher(bad)).toThrow("ECOTAXA_TOKEN_ENCRYPTION_KEY must be 32 bytes");
    });
});
