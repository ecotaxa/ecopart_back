import sqlite3 from "sqlite3";
import fs from "fs";

import { SQLiteDatabaseWrapper } from "../../../src/data/interfaces/data-sources/database-wrapper";
import { migration } from "../../../src/data/migrations/031_uvp5_max_pressure_in_decibar";

const TEST_DB = "TEST_DB_UVP5_MAX_PRESSURE_MIGRATION";

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

// Same column affinity as production (INTEGER, nullable since 027), so a REAL result is checked as stored.
beforeEach(async () => {
    try { fs.unlinkSync(TEST_DB); } catch { /* absent — fine */ }
    db = new sqlite3.Database(TEST_DB);
    await runSQL(wrapper(), `CREATE TABLE instrument_model (instrument_model_id INTEGER PRIMARY KEY AUTOINCREMENT, instrument_model_name TEXT);`);
    await runSQL(wrapper(), `CREATE TABLE project (project_id INTEGER PRIMARY KEY AUTOINCREMENT, instrument_model INTEGER);`);
    await runSQL(wrapper(), `CREATE TABLE sample (
        sample_id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        max_pressure INTEGER
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

async function seedSample(sample_id: number, project_id: number, max_pressure: number | null): Promise<void> {
    await runSQL(wrapper(), `INSERT INTO sample (sample_id, project_id, max_pressure) VALUES (?, ?, ?);`,
        [sample_id, project_id, max_pressure]);
}

function readMaxPressures(): Promise<{ sample_id: number, max_pressure: number | null }[]> {
    return allSQL(wrapper(), `SELECT sample_id, max_pressure FROM sample ORDER BY sample_id;`);
}

describe("031_uvp5_max_pressure_in_decibar", () => {
    test("converts the UVP5 values from centibar to decibar without float noise and leaves the UVP6 ones alone", async () => {
        await seedProject(1, 1); // UVP5HD
        await seedProject(2, 2); // UVP5SD
        await seedProject(3, 4); // UVP6LP
        await seedSample(1, 1, 822);
        await seedSample(2, 2, 9894);
        await seedSample(3, 2, 150);
        await seedSample(4, 3, 29.84);

        await migration.up(wrapper());

        expect(await readMaxPressures()).toEqual([
            { sample_id: 1, max_pressure: 82.2 },
            { sample_id: 2, max_pressure: 989.4 },
            { sample_id: 3, max_pressure: 15 },
            { sample_id: 4, max_pressure: 29.84 },
        ]);
    });

    test("keeps a NULL max_pressure NULL", async () => {
        await seedProject(1, 3); // UVP5Z
        await seedSample(1, 1, null);

        await migration.up(wrapper());

        expect(await readMaxPressures()).toEqual([{ sample_id: 1, max_pressure: null }]);
    });

    test("skips samples whose project has no resolvable instrument model", async () => {
        await seedProject(1, null);
        await seedSample(1, 1, 822);
        await seedSample(2, 404, 822);

        await migration.up(wrapper());

        expect(await readMaxPressures()).toEqual([
            { sample_id: 1, max_pressure: 822 },
            { sample_id: 2, max_pressure: 822 },
        ]);
    });

    test("down brings the UVP5 values back to integer centibar", async () => {
        await seedProject(1, 1);
        await seedProject(2, 5); // UVP6HF
        await seedSample(1, 1, 9894);
        await seedSample(2, 1, null);
        await seedSample(3, 2, 29.84);

        await migration.up(wrapper());
        await migration.down(wrapper());

        expect(await readMaxPressures()).toEqual([
            { sample_id: 1, max_pressure: 9894 },
            { sample_id: 2, max_pressure: null },
            { sample_id: 3, max_pressure: 29.84 },
        ]);
    });
});
