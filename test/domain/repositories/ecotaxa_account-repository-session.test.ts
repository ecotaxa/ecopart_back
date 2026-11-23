import fs from "fs";
import os from "os";
import path from "path";
import sqlite3 from "sqlite3";
import { randomBytes } from "crypto";
import { MigrationManager } from "../../../src/data/migrations/migration-manager";
import { SQLiteEcotaxaAccountDataSource } from "../../../src/data/data-sources/sqlite/sqlite-ecotaxa_account-data-source";
import { EcotaxaAccountRepositoryImpl } from "../../../src/domain/repositories/ecotaxa_account-repository";
import { AesGcmTokenCipher } from "../../../src/infra/cryptography/aes-gcm-token-cipher";

// Real SQLite database, EcoTaxa answered by a fake fetch: the session of an account is refreshed with its
// refresh token (EcoTaxa api/token/refresh) when EcoTaxa refuses its access token, and both tokens are saved.
const GENERIC_EMAIL = "ecopart@example.org";
const BASE_URL = "https://ecotaxa.test/";
const DAY_MS = 24 * 3600 * 1000;

type FakeResponse = { status: number; ok: boolean; statusText: string; json: () => Promise<unknown>; text: () => Promise<string>; clone: () => FakeResponse };
function reply(status: number, body: unknown = null): FakeResponse {
    const response: FakeResponse = {
        status, ok: status >= 200 && status < 300, statusText: String(status),
        json: async () => body, text: async () => JSON.stringify(body), clone: () => response,
    };
    return response;
}
function pair(n: number) {
    return { access_token: `access-${n}`, token_type: "bearer", expires_in: 3600, refresh_token: `refresh-${n}`, refresh_expires_in: 864000 };
}

function run(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => db.run(sql, params, (err) => err ? reject(err) : resolve()));
}
function storedRow(db: sqlite3.Database, id: number): Promise<{ ecotaxa_account_token: string; ecotaxa_account_refresh_token: string | null; ecotaxa_account_expiration_utc_date_time: string }> {
    return new Promise((resolve, reject) => db.get("SELECT * FROM ecotaxa_account WHERE ecotaxa_account_id = ?", [id], (err, row: any) => err ? reject(err) : resolve(row)));
}

describe("EcoTaxa account sessions", () => {
    let workdir: string;
    let db: sqlite3.Database;
    let repo: EcotaxaAccountRepositoryImpl;
    let calls: Array<{ url: string; authorization?: string; body?: string }>;
    // What EcoTaxa answers: the routes of the API, the access tokens it accepts.
    let accepted_tokens: Set<string>;
    let refresh_answers: Array<() => FakeResponse>;

    async function createAccount(token: string, refresh_token: string | null, expiration = new Date(Date.now() + 5 * DAY_MS).toISOString()): Promise<number> {
        return repo.createEcotaxaAccount({
            ecotaxa_account_ecotaxa_id: 7,
            ecotaxa_account_ecopart_user_id: 101,
            ecotaxa_account_token: token,
            ecotaxa_account_refresh_token: refresh_token,
            ecotaxa_account_user_name: "name",
            ecotaxa_account_user_email: "a@example.org",
            ecotaxa_account_instance_id: 1,
            ecotaxa_account_expiration_utc_date_time: expiration,
        });
    }

    beforeEach(async () => {
        jest.spyOn(console, "log").mockImplementation(() => undefined);
        workdir = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart_ecotaxa_sessions_"));
        db = await new Promise<sqlite3.Database>((resolve, reject) => {
            const database: sqlite3.Database = new sqlite3.Database(path.join(workdir, "test.db"), (err) => err ? reject(err) : resolve(database));
        });
        await run(db, "PRAGMA foreign_keys = ON");
        await new MigrationManager(db).runAllMigrations(path.resolve(__dirname, "../../../src/data/migrations"));
        await run(db, "INSERT INTO user (user_id, first_name, last_name, email, password_hash, organisation, country, user_planned_usage) VALUES (101, 'f', 'l', 'u@example.org', 'h', 'o', 'c', 'u')");
        await run(db, "INSERT OR REPLACE INTO ecotaxa_instance (ecotaxa_instance_id, ecotaxa_instance_name, ecotaxa_instance_description, ecotaxa_instance_url) VALUES (1, 'test', 'test', ?)", [BASE_URL]);

        repo = new EcotaxaAccountRepositoryImpl(new SQLiteEcotaxaAccountDataSource(db), GENERIC_EMAIL, "PROD", false, new AesGcmTokenCipher(randomBytes(32).toString("base64")));
        calls = [];
        accepted_tokens = new Set();
        refresh_answers = [];
        jest.spyOn(repo as any, "rawFetch").mockImplementation(async (...args: unknown[]) => {
            const [url, init] = args as [string, { headers?: Record<string, string>; body?: string }];
            const authorization = init?.headers?.Authorization;
            calls.push({ url, authorization, body: init?.body });
            if (url === BASE_URL + "api/token") return reply(200, pair(1));
            if (url === BASE_URL + "api/token/refresh") {
                const answer = refresh_answers.shift();
                return answer ? answer() : reply(401, { detail: "Could not validate credentials" });
            }
            if (url === BASE_URL + "api/token/revoke") return reply(200, null);
            if (url === BASE_URL + "api/users/me") return reply(200, { id: 7, name: "name" });
            const token = authorization?.replace("Bearer ", "");
            return token && accepted_tokens.has(token) ? reply(200, [{ projid: 1, title: "p", instrument: "UVP6" }]) : reply(401, { detail: "Could not validate credentials" });
        });
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        await new Promise<void>((resolve) => db.close(() => resolve()));
        fs.rmSync(workdir, { recursive: true, force: true });
    });

    test("logging in uses api/token and keeps both tokens, the session ending with the refresh token", async () => {
        const before = Date.now();
        const session = await repo.connectToEcotaxaInstance({ ecopart_user_id: 101, ecotaxa_user_login: "a@example.org", ecotaxa_user_password: "pw", ecotaxa_instance_id: 1 });

        expect(calls[0].url).toBe(BASE_URL + "api/token");
        expect(calls[0].body).toBe("grant_type=password&username=a%40example.org&password=pw");
        expect(session.ecotaxa_token).toBe("access-1");
        expect(session.ecotaxa_refresh_token).toBe("refresh-1");
        const expiration = new Date(session.ecotaxa_expiration_date).getTime();
        expect(expiration).toBeGreaterThanOrEqual(before + 864000 * 1000);
        expect(expiration).toBeLessThan(before + 864000 * 1000 + 60_000);
    });

    test("an EcoTaxa without api/token gets the former api/login, without refresh token", async () => {
        (repo as any).rawFetch.mockImplementation(async (url: string) => {
            if (url === BASE_URL + "api/token") return reply(404, { detail: "Not Found" });
            if (url === BASE_URL + "api/login") return reply(200, "legacy-token");
            return reply(200, { id: 7, name: "name" });
        });
        const session = await repo.connectToEcotaxaInstance({ ecopart_user_id: 101, ecotaxa_user_login: "a@example.org", ecotaxa_user_password: "pw", ecotaxa_instance_id: 1 });

        expect(session.ecotaxa_token).toBe("legacy-token");
        expect(session.ecotaxa_refresh_token).toBeNull();
        expect(new Date(session.ecotaxa_expiration_date).getTime()).toBeGreaterThan(Date.now() + 29 * DAY_MS);
    });

    test("the refresh token is stored encrypted and read back in clear", async () => {
        const id = await createAccount("access-0", "refresh-0");

        const row = await storedRow(db, id);
        expect(row.ecotaxa_account_refresh_token?.startsWith("enc:v1:")).toBe(true);
        expect((await repo.getOneEcotaxaAccount(id))?.ecotaxa_account_refresh_token).toBe("refresh-0");
    });

    test("a call refused with an expired access token refreshes the session, saves both tokens and is sent again", async () => {
        const id = await createAccount("access-0", "refresh-0");
        const account = await repo.getOneEcotaxaAccount(id);
        accepted_tokens.add("access-2");
        refresh_answers.push(() => reply(200, pair(2)));

        const projects = await repo.listManageableEcotaxaProjects(account!);

        expect(projects).toHaveLength(1);
        expect(calls.map((call) => call.url.replace(BASE_URL, ""))).toEqual(["api/projects/search?for_managing=true", "api/token/refresh", "api/projects/search?for_managing=true"]);
        expect(JSON.parse(calls[1].body as string)).toEqual({ refresh_token: "refresh-0" });
        expect(calls[2].authorization).toBe("Bearer access-2");

        const stored = await repo.getOneEcotaxaAccount(id);
        expect(stored?.ecotaxa_account_token).toBe("access-2");
        expect(stored?.ecotaxa_account_refresh_token).toBe("refresh-2");
        expect(new Date(stored!.ecotaxa_account_expiration_utc_date_time).getTime()).toBeGreaterThan(Date.now() + 9 * DAY_MS);
        const row = await storedRow(db, id);
        expect(row.ecotaxa_account_token.startsWith("enc:v1:")).toBe(true);
        expect(row.ecotaxa_account_refresh_token?.startsWith("enc:v1:")).toBe(true);
    });

    test("callers refused at the same time share one refresh: a refresh token is single-use", async () => {
        const id = await createAccount("access-0", "refresh-0");
        const account = await repo.getOneEcotaxaAccount(id);
        accepted_tokens.add("access-2");
        refresh_answers.push(() => reply(200, pair(2)));

        await Promise.all([repo.listManageableEcotaxaProjects(account!), repo.listManageableEcotaxaProjects(account!), repo.listManageableEcotaxaProjects(account!)]);

        expect(calls.filter((call) => call.url.endsWith("api/token/refresh"))).toHaveLength(1);
        expect(calls.filter((call) => call.authorization === "Bearer access-2")).toHaveLength(3);
    });

    test("a caller still holding the replaced token sends the new one, without another refresh", async () => {
        const id = await createAccount("access-0", "refresh-0");
        const account = await repo.getOneEcotaxaAccount(id);
        accepted_tokens.add("access-2");
        refresh_answers.push(() => reply(200, pair(2)));
        await repo.listManageableEcotaxaProjects(account!);
        calls = [];

        // e.g. an import job polled for hours with the token read when it started
        await repo.api_ecotaxa_get_taxa(BASE_URL, "access-0", [1]);

        expect(calls).toEqual([expect.objectContaining({ authorization: "Bearer access-2" })]);
    });

    test("when EcoTaxa refuses the refresh token, the caller gets EcoTaxa's 401 and the account shows as expired", async () => {
        const id = await createAccount("access-0", "refresh-0");
        const account = await repo.getOneEcotaxaAccount(id);

        await expect(repo.listManageableEcotaxaProjects(account!)).rejects.toThrow(/^HTTP 401/);

        const stored = await repo.getOneEcotaxaAccount(id);
        expect(new Date(stored!.ecotaxa_account_expiration_utc_date_time).getTime()).toBeLessThanOrEqual(Date.now());
        expect(stored?.ecotaxa_account_token).toBe("access-0");
    });

    test("an account without refresh token (former api/login) is not refreshed", async () => {
        const id = await createAccount("legacy-token", null);
        const account = await repo.getOneEcotaxaAccount(id);

        await expect(repo.listManageableEcotaxaProjects(account!)).rejects.toThrow(/^HTTP 401/);
        expect(calls.filter((call) => call.url.endsWith("api/token/refresh"))).toHaveLength(0);
        await expect(repo.refreshEcotaxaAccountSession(id)).rejects.toThrow("Ecotaxa account session expired");
    });

    test("refreshEcotaxaAccountSession renews the session on demand", async () => {
        const id = await createAccount("access-0", "refresh-0", new Date(Date.now() - DAY_MS).toISOString());
        refresh_answers.push(() => reply(200, pair(3)));

        const refreshed = await repo.refreshEcotaxaAccountSession(id);

        expect(refreshed.ecotaxa_account_token).toBe("access-3");
        expect(refreshed.ecotaxa_account_refresh_token).toBe("refresh-3");
        expect(new Date(refreshed.ecotaxa_account_expiration_utc_date_time).getTime()).toBeGreaterThan(Date.now());
    });

    test("an EcoTaxa error other than a refused refresh token leaves the account as it was", async () => {
        const expiration = new Date(Date.now() + DAY_MS).toISOString();
        const id = await createAccount("access-0", "refresh-0", expiration);
        refresh_answers.push(() => reply(502, "Bad gateway"));

        await expect(repo.refreshEcotaxaAccountSession(id)).rejects.toThrow(/Cannot refresh the EcoTaxa session, EcoTaxa HTTP Error: 502/);
        const stored = await repo.getOneEcotaxaAccount(id);
        expect(stored?.ecotaxa_account_refresh_token).toBe("refresh-0");
        expect(stored?.ecotaxa_account_expiration_utc_date_time).toBe(expiration);
    });

    test("a call with a token of no stored account is not refreshed", async () => {
        await expect(repo.api_ecotaxa_get_taxa(BASE_URL, "transient-token", [1])).rejects.toThrow(/^HTTP 401/);
        expect(calls).toHaveLength(1);
    });

    test("removing the account revokes its EcoTaxa session", async () => {
        const id = await createAccount("access-0", "refresh-0");

        await repo.deleteEcotaxaAccount({ ecotaxa_account_id: id, ecotaxa_account_ecopart_user_id: 101 });

        expect(calls.map((call) => [call.url, call.body])).toEqual([[BASE_URL + "api/token/revoke", JSON.stringify({ refresh_token: "refresh-0" })]]);
        expect(await repo.getOneEcotaxaAccount(id)).toBeNull();
    });

    test("startup encrypts a refresh token saved in clear", async () => {
        const plain = new EcotaxaAccountRepositoryImpl(new SQLiteEcotaxaAccountDataSource(db), GENERIC_EMAIL, "PROD");
        const id = await plain.createEcotaxaAccount({
            ecotaxa_account_ecotaxa_id: 7, ecotaxa_account_ecopart_user_id: 101, ecotaxa_account_token: "access-0", ecotaxa_account_refresh_token: "refresh-0",
            ecotaxa_account_user_name: "name", ecotaxa_account_user_email: "a@example.org", ecotaxa_account_instance_id: 1, ecotaxa_account_expiration_utc_date_time: "2030-01-01T00:00:00.000Z",
        });

        expect(await repo.encryptStoredTokens()).toEqual({ encrypted: 1, unreadable: 0 });
        const row = await storedRow(db, id);
        expect(row.ecotaxa_account_refresh_token?.startsWith("enc:v1:")).toBe(true);
        expect(row.ecotaxa_account_expiration_utc_date_time).toBe("2030-01-01T00:00:00.000Z");
        expect((await repo.getOneEcotaxaAccount(id))?.ecotaxa_account_refresh_token).toBe("refresh-0");
        expect(await repo.encryptStoredTokens()).toEqual({ encrypted: 0, unreadable: 0 });
    });
});
