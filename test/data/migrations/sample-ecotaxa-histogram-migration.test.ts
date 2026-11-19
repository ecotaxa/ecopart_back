import sqlite3 from "sqlite3";
import fs from "fs";

import { SQLiteDatabaseWrapper } from "../../../src/data/interfaces/data-sources/database-wrapper";
import { migration } from "../../../src/data/migrations/042_sample_ecotaxa_histogram";

const TEST_DB = "TEST_DB_SAMPLE_ECOTAXA_HISTOGRAM_MIGRATION";

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

const insertHistogram = (sample_id: number) => runSQL(wrapper(), `INSERT INTO sample_ecotaxa_histogram
    (sample_id, ecotaxa_sample_id, depth_offset_m, nb_validated, nb_predicted, bins, fetched_utc_date_time)
    VALUES (?, 9000 + ?, 1.2, 10, 3, '[[45072,2,10,3]]', '2026-11-19T08:00:00.000Z');`, [sample_id, sample_id]);

describe("042_sample_ecotaxa_histogram", () => {
    test("creates the table, keyed by sample, twice without error", async () => {
        await migration.up(wrapper());
        await insertHistogram(1);
        await migration.up(wrapper());

        expect(await tables()).toEqual(["sample", "sample_ecotaxa_histogram"]);
        const columns = await allSQL<{ name: string; notnull: number; pk: number }>(wrapper(), `PRAGMA table_info(sample_ecotaxa_histogram);`);
        expect(columns.map(c => c.name)).toEqual(["sample_id", "ecotaxa_sample_id", "depth_offset_m", "nb_validated", "nb_predicted", "bins", "fetched_utc_date_time"]);
        expect(columns.filter(c => c.pk === 1).map(c => c.name)).toEqual(["sample_id"]);
        expect(columns.filter(c => c.name !== "sample_id").every(c => c.notnull === 1)).toBe(true);
        // The second run keeps the rows.
        expect(await allSQL(wrapper(), `SELECT sample_id, depth_offset_m, bins FROM sample_ecotaxa_histogram;`)).toEqual([{ sample_id: 1, depth_offset_m: 1.2, bins: "[[45072,2,10,3]]" }]);
    });

    test("one row per sample", async () => {
        await migration.up(wrapper());
        await insertHistogram(1);

        await expect(insertHistogram(1)).rejects.toThrow(/UNIQUE constraint failed/);
    });

    test("with foreign keys on, the histogram of a deleted sample goes with it, and a histogram needs an existing sample", async () => {
        await migration.up(wrapper());
        await runSQL(wrapper(), `PRAGMA foreign_keys = ON;`);
        await insertHistogram(1);
        await insertHistogram(2);

        await runSQL(wrapper(), `DELETE FROM sample WHERE sample_id = 1;`);

        expect(await allSQL(wrapper(), `SELECT sample_id FROM sample_ecotaxa_histogram;`)).toEqual([{ sample_id: 2 }]);
        await expect(insertHistogram(42)).rejects.toThrow(/FOREIGN KEY constraint failed/);
    });

    test("down drops the table, twice without error", async () => {
        await migration.up(wrapper());
        await migration.down(wrapper());
        await migration.down(wrapper());

        expect(await tables()).toEqual(["sample"]);
    });
});
