import sqlite3 from "sqlite3";
import fs from "fs";

import { SQLiteDatabaseWrapper } from "../../../src/data/interfaces/data-sources/database-wrapper";
import { migration } from "../../../src/data/migrations/040_uvp6_aa_in_mm2";

const TEST_DB = "TEST_DB_UVP6_AA_MIGRATION";

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
        instrument_settings_aa INTEGER NOT NULL
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

async function seedSample(sample_id: number, project_id: number, aa: number): Promise<void> {
    await runSQL(wrapper(), `INSERT INTO sample (sample_id, project_id, instrument_settings_aa) VALUES (?, ?, ?);`,
        [sample_id, project_id, aa]);
}

function readAa(): Promise<{ sample_id: number, aa: number }[]> {
    return allSQL(wrapper(), `SELECT sample_id, instrument_settings_aa AS aa FROM sample ORDER BY sample_id;`);
}

describe("040_uvp6_aa_in_mm2", () => {
    test("converts the UVP6 values to mm² per pixel and leaves the UVP5 ones alone", async () => {
        await seedProject(1, 4); // UVP6LP
        await seedProject(2, 5); // UVP6HF
        await seedProject(3, 1); // UVP5HD
        await seedSample(1, 1, 2300);
        await seedSample(2, 2, 3619.1);
        await seedSample(3, 3, 0.0026);

        await migration.up(wrapper());

        expect(await readAa()).toEqual([
            { sample_id: 1, aa: 0.0023 },
            { sample_id: 2, aa: 0.0036191 },
            { sample_id: 3, aa: 0.0026 },
        ]);
    });

    test("gives the value the import now stores, bit for bit", async () => {
        await seedProject(1, 4);
        await seedSample(1, 1, 3619.1);

        await migration.up(wrapper());

        // The import divides `HW_CONF.Aa` by 1e6; the project statistics compare the values exactly.
        expect((await readAa())[0].aa).toBe(Number("3619.1") / 1e6);
    });

    test("is idempotent and keeps UVP6 samples already imported in mm² per pixel", async () => {
        await seedProject(1, 4);
        await seedSample(1, 1, 2300);
        await seedSample(2, 1, 0.0023);

        await migration.up(wrapper());
        await migration.up(wrapper());

        expect(await readAa()).toEqual([
            { sample_id: 1, aa: 0.0023 },
            { sample_id: 2, aa: 0.0023 },
        ]);
    });

    test("skips samples whose project has no resolvable instrument model", async () => {
        await seedProject(1, null);
        await seedSample(1, 1, 2300);
        await seedSample(2, 404, 2300);

        await migration.up(wrapper());

        expect(await readAa()).toEqual([
            { sample_id: 1, aa: 2300 },
            { sample_id: 2, aa: 2300 },
        ]);
    });

    test("down brings the UVP6 values back to the instrument's unit", async () => {
        await seedProject(1, 4);
        await seedProject(2, 2); // UVP5SD
        await seedSample(1, 1, 2300);
        await seedSample(2, 1, 1130);
        await seedSample(3, 2, 0.0032);

        await migration.up(wrapper());
        await migration.down(wrapper());

        expect(await readAa()).toEqual([
            { sample_id: 1, aa: 2300 },
            { sample_id: 2, aa: 1130 },
            { sample_id: 3, aa: 0.0032 },
        ]);
    });
});
