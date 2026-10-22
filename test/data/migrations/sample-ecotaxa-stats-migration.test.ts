import sqlite3 from "sqlite3";
import fs from "fs";

import { SQLiteDatabaseWrapper } from "../../../src/data/interfaces/data-sources/database-wrapper";
import { migration } from "../../../src/data/migrations/034_sample_ecotaxa_stats";

const TEST_DB = "TEST_DB_SAMPLE_ECOTAXA_STATS_MIGRATION";

function runSQL(db: SQLiteDatabaseWrapper, sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err: Error | null) {
            if (err) reject(err);
            else resolve();
        });
    });
}

function allSQL<T = any>(db: SQLiteDatabaseWrapper, sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err: Error | null, rows: any[]) => {
            if (err) reject(err);
            else resolve((rows || []) as T[]);
        });
    });
}

let db: sqlite3.Database;
const wrapper = () => db as unknown as SQLiteDatabaseWrapper;

beforeEach(async () => {
    try { fs.unlinkSync(TEST_DB); } catch { /* absent — fine */ }
    db = new sqlite3.Database(TEST_DB);
    await runSQL(wrapper(), `CREATE TABLE sample (sample_id INTEGER PRIMARY KEY AUTOINCREMENT, sample_name TEXT NOT NULL);`);
    await runSQL(wrapper(), `INSERT INTO sample (sample_id, sample_name) VALUES (1, 'moose_001'), (2, 'moose_002');`);
});

afterEach(async () => {
    await new Promise<void>((resolve) => db.close(() => resolve()));
    try { fs.unlinkSync(TEST_DB); } catch { /* already gone — fine */ }
});

async function tables(): Promise<string[]> {
    return (await allSQL<{ name: string }>(wrapper(), `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;`)).map(t => t.name);
}

const insertStats = (sample_id: number) => runSQL(wrapper(), `INSERT INTO sample_ecotaxa_stats
    (sample_id, ecotaxa_sample_id, nb_unclassified, nb_validated, nb_dubious, nb_predicted, used_taxa, fetched_utc_date_time)
    VALUES (?, 9000 + ?, 0, 10, 0, 0, '1,2', '2026-10-22T08:00:00.000Z');`, [sample_id, sample_id]);

describe("034_sample_ecotaxa_stats", () => {
    test("creates the table, keyed by sample, twice without error", async () => {
        await migration.up(wrapper());
        await insertStats(1);
        await migration.up(wrapper());

        expect(await tables()).toEqual(["sample", "sample_ecotaxa_stats"]);
        const columns = await allSQL<{ name: string; notnull: number; pk: number }>(wrapper(), `PRAGMA table_info(sample_ecotaxa_stats);`);
        expect(columns.map(c => c.name)).toEqual(["sample_id", "ecotaxa_sample_id", "nb_unclassified", "nb_validated", "nb_dubious", "nb_predicted", "used_taxa", "fetched_utc_date_time"]);
        expect(columns.filter(c => c.pk === 1).map(c => c.name)).toEqual(["sample_id"]);
        expect(columns.filter(c => c.name !== "sample_id").every(c => c.notnull === 1)).toBe(true);
        // The second run keeps the rows.
        expect(await allSQL(wrapper(), `SELECT sample_id, used_taxa FROM sample_ecotaxa_stats;`)).toEqual([{ sample_id: 1, used_taxa: "1,2" }]);
    });

    test("one row per sample", async () => {
        await migration.up(wrapper());
        await insertStats(1);

        await expect(insertStats(1)).rejects.toThrow(/UNIQUE constraint failed/);
    });

    test("with foreign keys on, the stats of a deleted sample go with it, and stats need an existing sample", async () => {
        await migration.up(wrapper());
        await runSQL(wrapper(), `PRAGMA foreign_keys = ON;`);
        await insertStats(1);
        await insertStats(2);

        await runSQL(wrapper(), `DELETE FROM sample WHERE sample_id = 1;`);

        expect(await allSQL(wrapper(), `SELECT sample_id FROM sample_ecotaxa_stats;`)).toEqual([{ sample_id: 2 }]);
        await expect(insertStats(42)).rejects.toThrow(/FOREIGN KEY constraint failed/);
    });

    test("down drops the table, twice without error", async () => {
        await migration.up(wrapper());
        await migration.down(wrapper());
        await migration.down(wrapper());

        expect(await tables()).toEqual(["sample"]);
    });
});
