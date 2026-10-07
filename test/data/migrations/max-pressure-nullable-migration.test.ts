import sqlite3 from "sqlite3";
import fs from "fs";

import { SQLiteDatabaseWrapper } from "../../../src/data/interfaces/data-sources/database-wrapper";
import { migration } from "../../../src/data/migrations/027_make_max_pressure_nullable";

const TEST_DB = "TEST_DB_MAX_PRESSURE_NULLABLE_MIGRATION";

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

const maxPressureNotNull = async (): Promise<number> =>
    (await allSQL<{ name: string, notnull: number }>(wrapper(), `PRAGMA table_info(sample);`)).find(c => c.name === "max_pressure")!.notnull;

beforeEach(async () => {
    try { fs.unlinkSync(TEST_DB); } catch { /* absent — fine */ }
    db = new sqlite3.Database(TEST_DB);
    await runSQL(wrapper(), `PRAGMA foreign_keys = ON;`);
    await runSQL(wrapper(), `CREATE TABLE project (project_id INTEGER PRIMARY KEY AUTOINCREMENT);`);
    // Same shape as production: NOT NULL max_pressure, a FK, the unique constraint, and a column
    // added by a later ALTER (the rebuild must start from the live definition, not from 000).
    await runSQL(wrapper(), `CREATE TABLE 'sample' (
        sample_id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_name TEXT NOT NULL,
        max_pressure INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES project(project_id),
        CONSTRAINT Unique_proj_id_sample_name UNIQUE (project_id, sample_name)
    );`);
    await runSQL(wrapper(), `ALTER TABLE sample ADD COLUMN nb_black INTEGER NOT NULL DEFAULT 0;`);
    await runSQL(wrapper(), `INSERT INTO project (project_id) VALUES (1);`);
    await runSQL(wrapper(), `INSERT INTO sample (sample_name, max_pressure, project_id, nb_black) VALUES ('a', 1331, 1, 3), ('b', 864, 1, 0), ('c', 12, 1, 0);`);
    // The highest sample_id (3) is gone: the rebuild must not hand it out again.
    await runSQL(wrapper(), `DELETE FROM sample WHERE sample_name = 'c';`);
});

afterEach(async () => {
    await new Promise<void>((resolve) => db.close(() => resolve()));
    try { fs.unlinkSync(TEST_DB); } catch { /* already gone — fine */ }
});

describe("027_make_max_pressure_nullable", () => {
    test("up makes max_pressure nullable and keeps the rows, the later columns, the constraints and the id counter", async () => {
        await migration.up(wrapper());

        expect(await maxPressureNotNull()).toBe(0);
        expect(await allSQL(wrapper(), `SELECT sample_id, sample_name, max_pressure, nb_black FROM sample ORDER BY sample_id;`)).toEqual([
            { sample_id: 1, sample_name: "a", max_pressure: 1331, nb_black: 3 },
            { sample_id: 2, sample_name: "b", max_pressure: 864, nb_black: 0 },
        ]);

        await runSQL(wrapper(), `INSERT INTO sample (sample_name, max_pressure, project_id) VALUES ('drifting', NULL, 1);`);
        expect(await allSQL(wrapper(), `SELECT sample_id, max_pressure FROM sample WHERE sample_name = 'drifting';`)).toEqual([{ sample_id: 4, max_pressure: null }]);

        await expect(runSQL(wrapper(), `INSERT INTO sample (sample_name, max_pressure, project_id) VALUES ('a', 1, 1);`)).rejects.toThrow("UNIQUE constraint failed");
        await expect(runSQL(wrapper(), `INSERT INTO sample (sample_name, max_pressure, project_id) VALUES ('x', 1, 99);`)).rejects.toThrow("FOREIGN KEY constraint failed");
        expect(await allSQL(wrapper(), `PRAGMA foreign_keys;`)).toEqual([{ foreign_keys: 1 }]);
    });

    test("up is a no-op once max_pressure is nullable", async () => {
        await migration.up(wrapper());
        const [before] = await allSQL(wrapper(), `SELECT sql FROM sqlite_master WHERE name = 'sample';`);

        await migration.up(wrapper());

        expect(await allSQL(wrapper(), `SELECT sql FROM sqlite_master WHERE name = 'sample';`)).toEqual([before]);
    });

    test("down refuses while a sample has no max_pressure, then restores NOT NULL", async () => {
        await migration.up(wrapper());
        await runSQL(wrapper(), `INSERT INTO sample (sample_name, max_pressure, project_id) VALUES ('drifting', NULL, 1);`);

        await expect(migration.down(wrapper())).rejects.toThrow("Cannot make max_pressure NOT NULL again: 1 sample(s) have no max_pressure");
        expect(await maxPressureNotNull()).toBe(0);

        await runSQL(wrapper(), `DELETE FROM sample WHERE max_pressure IS NULL;`);
        await migration.down(wrapper());

        expect(await maxPressureNotNull()).toBe(1);
        expect(await allSQL(wrapper(), `SELECT COUNT(*) AS nb FROM sample;`)).toEqual([{ nb: 2 }]);
    });
});
