import fs from "fs";
import os from "os";
import path from "path";
import sqlite3 from "sqlite3";
import { randomBytes } from "crypto";
import { MigrationManager } from "../../../src/data/migrations/migration-manager";
import { SQLiteEcotaxaAccountDataSource } from "../../../src/data/data-sources/sqlite/sqlite-ecotaxa_account-data-source";
import { EcotaxaAccountRepositoryImpl } from "../../../src/domain/repositories/ecotaxa_account-repository";
import { AesGcmTokenCipher } from "../../../src/infra/cryptography/aes-gcm-token-cipher";
import { EcotaxaAccountRequestCreationModel } from "../../../src/domain/entities/ecotaxa_account";

// Real SQLite database: checks what is actually written in the ecotaxa_account table.
const GENERIC_EMAIL = "ecopart@example.org";

function run(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => db.run(sql, params, (err) => err ? reject(err) : resolve()));
}
function storedToken(db: sqlite3.Database, ecotaxa_account_id: number): Promise<string> {
    return new Promise((resolve, reject) => db.get("SELECT ecotaxa_account_token FROM ecotaxa_account WHERE ecotaxa_account_id = ?", [ecotaxa_account_id],
        (err, row: { ecotaxa_account_token: string }) => err ? reject(err) : resolve(row.ecotaxa_account_token)));
}
function account(ecopart_user_id: number, email: string, token: string): EcotaxaAccountRequestCreationModel {
    return {
        ecotaxa_account_ecotaxa_id: 7,
        ecotaxa_account_ecopart_user_id: ecopart_user_id,
        ecotaxa_account_token: token,
        ecotaxa_account_user_name: "name",
        ecotaxa_account_user_email: email,
        ecotaxa_account_instance_id: 1,
        ecotaxa_account_expiration_utc_date_time: "2030-01-01T00:00:00.000Z",
    };
}

describe("EcoTaxa account tokens at rest", () => {
    let workdir: string;
    let db: sqlite3.Database;
    let dataSource: SQLiteEcotaxaAccountDataSource;
    const key = randomBytes(32).toString("base64");

    beforeEach(async () => {
        jest.spyOn(console, "log").mockImplementation(() => undefined);
        workdir = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart_ecotaxa_tokens_"));
        db = await new Promise<sqlite3.Database>((resolve, reject) => {
            const database: sqlite3.Database = new sqlite3.Database(path.join(workdir, "test.db"), (err) => err ? reject(err) : resolve(database));
        });
        await run(db, "PRAGMA foreign_keys = ON");
        await new MigrationManager(db).runAllMigrations(path.resolve(__dirname, "../../../src/data/migrations"));
        for (const id of [101, 102]) {
            await run(db, "INSERT INTO user (user_id, first_name, last_name, email, password_hash, organisation, country, user_planned_usage) VALUES (?, 'f', 'l', ?, 'h', 'o', 'c', 'u')", [id, `user${id}@example.org`]);
        }
        dataSource = new SQLiteEcotaxaAccountDataSource(db);
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        await new Promise<void>((resolve) => db.close(() => resolve()));
        fs.rmSync(workdir, { recursive: true, force: true });
    });

    test("a new account is stored encrypted and read back in clear", async () => {
        const repo = new EcotaxaAccountRepositoryImpl(dataSource, GENERIC_EMAIL, "PROD", false, new AesGcmTokenCipher(key));
        const id = await repo.createEcotaxaAccount(account(101, "a@example.org", "secret-token-1"));

        const stored = await storedToken(db, id);
        expect(stored.startsWith("enc:v1:")).toBe(true);
        expect(stored).not.toContain("secret-token-1");
        expect((await repo.getOneEcotaxaAccount(id))?.ecotaxa_account_token).toBe("secret-token-1");
        const listed = await repo.standardGetEcotaxaAccountsModels({ filter: [{ field: "ecotaxa_account_ecopart_user_id", operator: "=", value: 101 }], sort_by: [], page: 1, limit: 10 });
        expect(listed.items.map((a) => a.ecotaxa_account_token)).toEqual(["secret-token-1"]);
    });

    test("without a key, behaves as before: stored and read in clear", async () => {
        const repo = new EcotaxaAccountRepositoryImpl(dataSource, GENERIC_EMAIL, "PROD");
        const id = await repo.createEcotaxaAccount(account(101, "a@example.org", "secret-token-1"));

        expect(await storedToken(db, id)).toBe("secret-token-1");
        expect((await repo.getOneEcotaxaAccount(id))?.ecotaxa_account_token).toBe("secret-token-1");
        expect(await repo.encryptStoredTokens()).toEqual({ encrypted: 0, unreadable: 0 });
    });

    test("startup encrypts the tokens saved in clear, once", async () => {
        const plain = new EcotaxaAccountRepositoryImpl(dataSource, GENERIC_EMAIL, "PROD");
        const id1 = await plain.createEcotaxaAccount(account(101, "a@example.org", "legacy-1"));
        const id2 = await plain.createEcotaxaAccount(account(102, "b@example.org", "legacy-2"));

        const repo = new EcotaxaAccountRepositoryImpl(dataSource, GENERIC_EMAIL, "PROD", false, new AesGcmTokenCipher(key));
        // Readable before the migration too
        expect((await repo.getOneEcotaxaAccount(id1))?.ecotaxa_account_token).toBe("legacy-1");

        expect(await repo.encryptStoredTokens()).toEqual({ encrypted: 2, unreadable: 0 });
        expect((await storedToken(db, id1)).startsWith("enc:v1:")).toBe(true);
        expect((await storedToken(db, id2)).startsWith("enc:v1:")).toBe(true);
        expect((await repo.getOneEcotaxaAccount(id2))?.ecotaxa_account_token).toBe("legacy-2");
        expect(await repo.encryptStoredTokens()).toEqual({ encrypted: 0, unreadable: 0 });
    });

    test("a token the current key cannot read is counted and handed out empty, without breaking listings", async () => {
        const id = await new EcotaxaAccountRepositoryImpl(dataSource, GENERIC_EMAIL, "PROD", false, new AesGcmTokenCipher(key))
            .createEcotaxaAccount(account(101, "a@example.org", "secret-token-1"));
        const otherKey = new EcotaxaAccountRepositoryImpl(dataSource, GENERIC_EMAIL, "PROD", false, new AesGcmTokenCipher(randomBytes(32).toString("base64")));

        expect(await otherKey.encryptStoredTokens()).toEqual({ encrypted: 0, unreadable: 1 });
        const read = await otherKey.getOneEcotaxaAccount(id);
        expect(read?.ecotaxa_account_user_email).toBe("a@example.org");
        expect(read?.ecotaxa_account_token).toBe("");
    });

    test("deleting a user's accounts removes them all except the generic one", async () => {
        const repo = new EcotaxaAccountRepositoryImpl(dataSource, GENERIC_EMAIL, "PROD", false, new AesGcmTokenCipher(key));
        const personal = await repo.createEcotaxaAccount(account(101, "a@example.org", "t1"));
        const generic = await repo.createEcotaxaAccount(account(101, GENERIC_EMAIL, "t-generic"));
        const otherUser = await repo.createEcotaxaAccount(account(102, "b@example.org", "t2"));

        expect(await repo.deleteEcotaxaAccountsOfUser(101)).toBe(1);

        expect(await repo.getOneEcotaxaAccount(personal)).toBeNull();
        expect((await repo.getOneEcotaxaAccount(generic))?.ecotaxa_account_token).toBe("t-generic");
        expect((await repo.getOneEcotaxaAccount(otherUser))?.ecotaxa_account_token).toBe("t2");
    });
});
