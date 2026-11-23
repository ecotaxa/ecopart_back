import sqlite3 from "sqlite3";
import fs from "fs";

import { SQLiteDatabaseWrapper } from "../../../src/data/interfaces/data-sources/database-wrapper";
import { migration } from "../../../src/data/migrations/044_backfill_sample_sampling_date_iso_format";

const TEST_DB = "TEST_DB_SAMPLE_SAMPLING_DATE_ISO_MIGRATION";

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
    await runSQL(wrapper(), `CREATE TABLE sample (sample_id INTEGER PRIMARY KEY AUTOINCREMENT, sample_name TEXT, sampling_utc_date_time TEXT);`);
    const rows: [string, string | null][] = [
        ["legacy_uvp5", "20120520080213"],
        ["legacy_uvp6", "20230406-144332-820"],
        ["legacy_uvp6_no_ms", "20230406-144332"],
        ["iso", "2024-06-12T10:20:00Z"],
        ["iso_ms", "2024-06-12T10:20:00.123Z"],
        ["unparsed", "not a date"],
        ["absent", null],
    ];
    for (const [sample_name, date] of rows) {
        await runSQL(wrapper(), `INSERT INTO sample (sample_name, sampling_utc_date_time) VALUES (?, ?);`, [sample_name, date]);
    }
});

afterEach(async () => {
    await new Promise<void>((resolve) => db.close(() => resolve()));
    try { fs.unlinkSync(TEST_DB); } catch { /* already gone — fine */ }
});

async function dates(): Promise<Record<string, string | null>> {
    const rows = await allSQL<{ sample_name: string, sampling_utc_date_time: string | null }>(wrapper(), `SELECT sample_name, sampling_utc_date_time FROM sample;`);
    return Object.fromEntries(rows.map(row => [row.sample_name, row.sampling_utc_date_time]));
}

const EXPECTED = {
    legacy_uvp5: "2012-05-20T08:02:13Z",
    legacy_uvp6: "2023-04-06T14:43:32Z",
    legacy_uvp6_no_ms: "2023-04-06T14:43:32Z",
    iso: "2024-06-12T10:20:00Z",
    iso_ms: "2024-06-12T10:20:00.123Z",
    unparsed: "not a date",
    absent: null,
};

describe("044_backfill_sample_sampling_date_iso_format", () => {
    test("the UVP date formats become ISO date-times, the other values are left as found : ok", async () => {
        await migration.up(wrapper());

        expect(await dates()).toEqual(EXPECTED);
    });

    test("running it twice changes nothing more : ok", async () => {
        await migration.up(wrapper());
        await migration.up(wrapper());

        expect(await dates()).toEqual(EXPECTED);
    });

    test("down leaves the dates as ISO : ok", async () => {
        await migration.up(wrapper());
        await migration.down(wrapper());

        expect(await dates()).toEqual(EXPECTED);
    });
});
