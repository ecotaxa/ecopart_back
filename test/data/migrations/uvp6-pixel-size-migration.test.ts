import sqlite3 from "sqlite3";
import fs from "fs";

import { SQLiteDatabaseWrapper } from "../../../src/data/interfaces/data-sources/database-wrapper";
import { migration } from "../../../src/data/migrations/030_uvp6_pixel_size_in_mm";

const TEST_DB = "TEST_DB_UVP6_PIXEL_SIZE_MIGRATION";

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

// Same column affinity as production (INTEGER NOT NULL), so a REAL result is checked as stored.
beforeEach(async () => {
    try { fs.unlinkSync(TEST_DB); } catch { /* absent — fine */ }
    db = new sqlite3.Database(TEST_DB);
    await runSQL(wrapper(), `CREATE TABLE instrument_model (instrument_model_id INTEGER PRIMARY KEY AUTOINCREMENT, instrument_model_name TEXT);`);
    await runSQL(wrapper(), `CREATE TABLE project (project_id INTEGER PRIMARY KEY AUTOINCREMENT, instrument_model INTEGER);`);
    await runSQL(wrapper(), `CREATE TABLE sample (
        sample_id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        instrument_settings_pixel_size_mm INTEGER NOT NULL
    );`);
    await runSQL(wrapper(), `INSERT INTO instrument_model (instrument_model_id, instrument_model_name) VALUES
        (1, 'UVP5HD'), (2, 'UVP5SD'), (3, 'UVP5Z'), (4, 'UVP6LP'), (5, 'UVP6HF');`);
});

afterEach(async () => {
    await new Promise<void>((resolve) => db.close(() => resolve()));
    try { fs.unlinkSync(TEST_DB); } catch { /* already gone — fine */ }
});

async function seedProject(project_id: number, instrument_model: number | null): Promise<void> {
    await runSQL(wrapper(), `INSERT INTO project (project_id, instrument_model) VALUES (?, ?);`, [project_id, instrument_model]);
}

async function seedSample(sample_id: number, project_id: number, pixel_size: number): Promise<void> {
    await runSQL(wrapper(), `INSERT INTO sample (sample_id, project_id, instrument_settings_pixel_size_mm) VALUES (?, ?, ?);`,
        [sample_id, project_id, pixel_size]);
}

function readPixelSizes(): Promise<{ sample_id: number, pixel: number }[]> {
    return allSQL(wrapper(), `SELECT sample_id, instrument_settings_pixel_size_mm AS pixel FROM sample ORDER BY sample_id;`);
}

describe("030_uvp6_pixel_size_in_mm", () => {
    test("converts the UVP6 values from µm to mm and leaves the UVP5 ones alone", async () => {
        await seedProject(1, 4); // UVP6LP
        await seedProject(2, 5); // UVP6HF
        await seedProject(3, 1); // UVP5HD
        await seedSample(1, 1, 73);
        await seedSample(2, 2, 73.5);
        await seedSample(3, 3, 0.118);

        await migration.up(wrapper());

        expect(await readPixelSizes()).toEqual([
            { sample_id: 1, pixel: 0.073 },
            { sample_id: 2, pixel: 0.0735 },
            { sample_id: 3, pixel: 0.118 },
        ]);
    });

    test("is idempotent and keeps UVP6 samples already imported in mm", async () => {
        await seedProject(1, 4);
        await seedSample(1, 1, 73);
        await seedSample(2, 1, 0.073);

        await migration.up(wrapper());
        await migration.up(wrapper());

        expect(await readPixelSizes()).toEqual([
            { sample_id: 1, pixel: 0.073 },
            { sample_id: 2, pixel: 0.073 },
        ]);
    });

    test("skips samples whose project has no resolvable instrument model", async () => {
        await seedProject(1, null);
        await seedSample(1, 1, 73);
        await seedSample(2, 404, 73);

        await migration.up(wrapper());

        expect(await readPixelSizes()).toEqual([
            { sample_id: 1, pixel: 73 },
            { sample_id: 2, pixel: 73 },
        ]);
    });

    test("down brings the UVP6 values back to µm", async () => {
        await seedProject(1, 4);
        await seedProject(2, 2); // UVP5SD
        await seedSample(1, 1, 73);
        await seedSample(2, 2, 0.174);

        await migration.up(wrapper());
        await migration.down(wrapper());

        expect(await readPixelSizes()).toEqual([
            { sample_id: 1, pixel: 73 },
            { sample_id: 2, pixel: 0.174 },
        ]);
    });
});
