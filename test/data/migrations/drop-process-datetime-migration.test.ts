import sqlite3 from "sqlite3";
import fs from "fs";

import { SQLiteDatabaseWrapper } from "../../../src/data/interfaces/data-sources/database-wrapper";
import { migration } from "../../../src/data/migrations/032_drop_sample_process_datetime";

const TEST_DB = "TEST_DB_DROP_PROCESS_DATETIME_MIGRATION";

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
    await runSQL(wrapper(), `CREATE TABLE sample (
        sample_id INTEGER PRIMARY KEY AUTOINCREMENT,
        instrument_settings_process_datetime TEXT,
        instrument_settings_process_gamma REAL
    );`);
    await runSQL(wrapper(), `INSERT INTO sample (sample_id, instrument_settings_process_gamma) VALUES (1, 3), (2, NULL);`);
});

afterEach(async () => {
    await new Promise<void>((resolve) => db.close(() => resolve()));
    try { fs.unlinkSync(TEST_DB); } catch { /* already gone — fine */ }
});

async function columns(): Promise<string[]> {
    return (await allSQL<{ name: string }>(wrapper(), `PRAGMA table_info(sample);`)).map(c => c.name);
}

describe("032_drop_sample_process_datetime", () => {
    test("drops the column and keeps the rows, twice without error", async () => {
        await migration.up(wrapper());
        await migration.up(wrapper());

        expect(await columns()).toEqual(["sample_id", "instrument_settings_process_gamma"]);
        expect(await allSQL(wrapper(), `SELECT sample_id, instrument_settings_process_gamma AS gamma FROM sample ORDER BY sample_id;`)).toEqual([
            { sample_id: 1, gamma: 3 },
            { sample_id: 2, gamma: null },
        ]);
    });

    test("down brings the column back empty, twice without error", async () => {
        await migration.up(wrapper());
        await migration.down(wrapper());
        await migration.down(wrapper());

        expect(await columns()).toEqual(["sample_id", "instrument_settings_process_gamma", "instrument_settings_process_datetime"]);
        expect(await allSQL(wrapper(), `SELECT instrument_settings_process_datetime AS d FROM sample;`)).toEqual([{ d: null }, { d: null }]);
    });
});
