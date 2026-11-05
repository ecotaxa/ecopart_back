import sqlite3 from "sqlite3";
import fs from "fs";

import { SQLiteDatabaseWrapper } from "../../../src/data/interfaces/data-sources/database-wrapper";
import { migration } from "../../../src/data/migrations/041_sample_environment_placeholders_to_null";

const TEST_DB = "TEST_DB_SAMPLE_ENVIRONMENT_PLACEHOLDERS_MIGRATION";

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

// Same column affinities as production: a placeholder text stays text in an INTEGER column.
beforeEach(async () => {
    try { fs.unlinkSync(TEST_DB); } catch { /* absent — fine */ }
    db = new sqlite3.Database(TEST_DB);
    await runSQL(wrapper(), `CREATE TABLE sample (
        sample_id INTEGER PRIMARY KEY AUTOINCREMENT,
        wind_direction INTEGER,
        wind_speed INTEGER,
        sea_state TEXT,
        nebulousness INTEGER,
        bottom_depth INTEGER
    );`);
});

afterEach(async () => {
    await new Promise<void>((resolve) => db.close(() => resolve()));
    try { fs.unlinkSync(TEST_DB); } catch { /* already gone — fine */ }
});

async function seedSample(sample_id: number, values: [unknown, unknown, unknown, unknown, unknown]): Promise<void> {
    await runSQL(wrapper(), `INSERT INTO sample (sample_id, wind_direction, wind_speed, sea_state, nebulousness, bottom_depth) VALUES (?, ?, ?, ?, ?, ?);`,
        [sample_id, ...values]);
}

function readSamples(): Promise<any[]> {
    return allSQL(wrapper(), `SELECT sample_id, wind_direction, wind_speed, sea_state, nebulousness, bottom_depth FROM sample ORDER BY sample_id;`);
}

describe("041_sample_environment_placeholders_to_null", () => {
    test("clears the NA / nan / blank texts and keeps every real value", async () => {
        await seedSample(1, ["nan", "nan", "nan", "nan", "nan"]);
        await seedSample(2, ["NA", " NaN ", "NA", "", "na"]);
        await seedSample(3, [270, 5.5, "3", 8, 2450]);
        await seedSample(4, [null, null, "calm", null, null]);

        await migration.up(wrapper());

        expect(await readSamples()).toEqual([
            { sample_id: 1, wind_direction: null, wind_speed: null, sea_state: null, nebulousness: null, bottom_depth: null },
            { sample_id: 2, wind_direction: null, wind_speed: null, sea_state: null, nebulousness: null, bottom_depth: null },
            { sample_id: 3, wind_direction: 270, wind_speed: 5.5, sea_state: "3", nebulousness: 8, bottom_depth: 2450 },
            { sample_id: 4, wind_direction: null, wind_speed: null, sea_state: "calm", nebulousness: null, bottom_depth: null },
        ]);
    });

    test("is idempotent", async () => {
        await seedSample(1, ["nan", 3, "NA", "nan", 12]);

        await migration.up(wrapper());
        await migration.up(wrapper());

        expect(await readSamples()).toEqual([
            { sample_id: 1, wind_direction: null, wind_speed: 3, sea_state: null, nebulousness: null, bottom_depth: 12 },
        ]);
    });
});
