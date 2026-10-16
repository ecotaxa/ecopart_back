import fs from "fs";
import os from "os";
import path from "path";
import sqlite3 from "sqlite3";
import { MigrationManager } from "../../../src/data/migrations/migration-manager";
import { SQLiteUserSessionDataSource } from "../../../src/data/data-sources/sqlite/sqlite-user-session-data-source";
import { AuthRepositoryImpl } from "../../../src/domain/repositories/auth-repository";
import { JwtAdapter } from "../../../src/infra/auth/jsonwebtoken";

const user = {
    user_id: 101, first_name: "f", last_name: "l", email: "u101@example.org", is_admin: false,
    organisation: "o", country: "c", user_planned_usage: "u", user_creation_utc_date_time: "2026-01-01T00:00:00.000Z",
};

function run(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => db.run(sql, params, (err) => err ? reject(err) : resolve()));
}
function count(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<number> {
    return new Promise((resolve, reject) => db.get(sql, params, (err, row: { n: number }) => err ? reject(err) : resolve(row.n)));
}

describe("Auth repository - login sessions (real SQLite)", () => {
    let workdir: string;
    let db: sqlite3.Database;
    let repo: AuthRepositoryImpl;

    beforeEach(async () => {
        workdir = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart_sessions_"));
        db = await new Promise<sqlite3.Database>((resolve, reject) => {
            const database: sqlite3.Database = new sqlite3.Database(path.join(workdir, "test.db"), (err) => err ? reject(err) : resolve(database));
        });
        await run(db, "PRAGMA foreign_keys = ON");
        await new MigrationManager(db).runAllMigrations(path.resolve(__dirname, "../../../src/data/migrations"));
        for (const id of [101, 102]) {
            await run(db, "INSERT INTO user (user_id, first_name, last_name, email, password_hash, organisation, country, user_planned_usage) VALUES (?, 'f', 'l', ?, 'h', 'o', 'c', 'u')", [id, `u${id}@example.org`]);
        }
        repo = new AuthRepositoryImpl(new JwtAdapter(), "access_for_test", "refresh_for_test", new SQLiteUserSessionDataSource(db));
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => db.close(() => resolve()));
        fs.rmSync(workdir, { recursive: true, force: true });
    });

    test("a new session is active for its user only", async () => {
        const sid = await repo.createSession(101);
        await expect(repo.ensureSessionIsActive(sid, 101)).resolves.toBeUndefined();
        await expect(repo.ensureSessionIsActive(sid, 102)).rejects.toThrow("Session revoked or expired");
    });

    test("a token without session id, issued before sessions existed, is refused", async () => {
        await expect(repo.ensureSessionIsActive(undefined, 101)).rejects.toThrow("Session revoked or expired");
        await expect(repo.ensureSessionIsActive("unknown-session", 101)).rejects.toThrow("Session revoked or expired");
    });

    test("a revoked session is refused and cannot be extended back", async () => {
        const sid = await repo.createSession(101);
        await repo.revokeSession(sid);
        await repo.extendSession(sid);
        await expect(repo.ensureSessionIsActive(sid, 101)).rejects.toThrow("Session revoked or expired");
    });

    test("an expired session is refused, and a refresh pushes the end back by thirty days", async () => {
        const sid = await repo.createSession(101);
        await run(db, "UPDATE user_session SET session_expiration_utc_date_time = ? WHERE session_id = ?", [new Date(Date.now() - 1000).toISOString(), sid]);
        await expect(repo.ensureSessionIsActive(sid, 101)).rejects.toThrow("Session revoked or expired");

        const other = await repo.createSession(101);
        await repo.extendSession(other);
        const end = await new Promise<string>((resolve, reject) => db.get("SELECT session_expiration_utc_date_time AS e FROM user_session WHERE session_id = ?", [other], (err, row: { e: string }) => err ? reject(err) : resolve(row.e)));
        const days = (new Date(end).getTime() - Date.now()) / (24 * 3600 * 1000);
        expect(days).toBeGreaterThan(29.9);
        expect(days).toBeLessThanOrEqual(30);
    });

    test("revoking the sessions of a user keeps the excepted one and those of other users", async () => {
        const current = await repo.createSession(101);
        const otherDevice = await repo.createSession(101);
        const someoneElse = await repo.createSession(102);

        expect(await repo.revokeUserSessions(101, current)).toBe(1);
        await expect(repo.ensureSessionIsActive(current, 101)).resolves.toBeUndefined();
        await expect(repo.ensureSessionIsActive(otherDevice, 101)).rejects.toThrow("Session revoked or expired");
        await expect(repo.ensureSessionIsActive(someoneElse, 102)).resolves.toBeUndefined();

        expect(await repo.revokeUserSessions(101)).toBe(1);
        await expect(repo.ensureSessionIsActive(current, 101)).rejects.toThrow("Session revoked or expired");
    });

    test("the refresh token carries its session id and decodes back", async () => {
        const sid = await repo.createSession(101);
        const decoded = repo.decodeRefreshToken(repo.generateRefreshToken(user, sid));
        expect(decoded?.sid).toBe(sid);
        expect(decoded?.user_id).toBe(101);
        expect(repo.decodeRefreshToken("not-a-token")).toBeNull();
        expect(repo.decodeRefreshToken(new AuthRepositoryImpl(new JwtAdapter(), "a", "another_secret", new SQLiteUserSessionDataSource(db)).generateRefreshToken(user, sid))).toBeNull();
    });

    test("ended sessions are purged after the retention period only", async () => {
        const recent = await repo.createSession(101);
        await repo.revokeSession(recent);
        const old = await repo.createSession(101);
        await run(db, "UPDATE user_session SET session_expiration_utc_date_time = ? WHERE session_id = ?", [new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(), old]);
        const active = await repo.createSession(102);

        expect(await repo.purgeEndedSessions()).toBe(1);
        expect(await count(db, "SELECT count(*) AS n FROM user_session WHERE session_id IN (?, ?)", [recent, active])).toBe(2);
    });
});
