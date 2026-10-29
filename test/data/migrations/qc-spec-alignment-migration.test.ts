import sqlite3 from "sqlite3";
import fs from "fs";

import { SQLiteDatabaseWrapper } from "../../../src/data/interfaces/data-sources/database-wrapper";
import { migration } from "../../../src/data/migrations/038_qc_spec_alignment";

const TEST_DB = "TEST_DB_QC_SPEC_ALIGNMENT_MIGRATION";

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
    try { fs.unlinkSync(TEST_DB); } catch { /* absent, fine */ }
    db = new sqlite3.Database(TEST_DB);
    await runSQL(wrapper(), `CREATE TABLE project (project_id INTEGER PRIMARY KEY AUTOINCREMENT, project_title TEXT NOT NULL);`);
    await runSQL(wrapper(), `CREATE TABLE sample (sample_id INTEGER PRIMARY KEY AUTOINCREMENT, sample_name TEXT NOT NULL, max_pressure REAL);`);
    await runSQL(wrapper(), `INSERT INTO project (project_id, project_title) VALUES (1, 'tara');`);
    await runSQL(wrapper(), `INSERT INTO sample (sample_id, sample_name, max_pressure) VALUES (1, 'tara_001', 512.4);`);
});

afterEach(async () => {
    await new Promise<void>((resolve) => db.close(() => resolve()));
    try { fs.unlinkSync(TEST_DB); } catch { /* already gone, fine */ }
});

const columns = async (table: string) => (await allSQL<{ name: string }>(wrapper(), `PRAGMA table_info(${table});`)).map(column => column.name);

describe("038_qc_spec_alignment", () => {
    test("adds the two project options with their defaults and the sample minimum pressure, unknown", async () => {
        await migration.up(wrapper());

        expect(await columns("project")).toEqual(["project_id", "project_title", "filtered_project", "time_duration_check"]);
        expect(await columns("sample")).toEqual(["sample_id", "sample_name", "max_pressure", "min_pressure"]);
        expect(await allSQL(wrapper(), `SELECT project_id, filtered_project, time_duration_check FROM project;`)).toEqual([{ project_id: 1, filtered_project: 0, time_duration_check: 1 }]);
        expect(await allSQL(wrapper(), `SELECT sample_id, max_pressure, min_pressure FROM sample;`)).toEqual([{ sample_id: 1, max_pressure: 512.4, min_pressure: null }]);
    });

    test("runs twice without error and keeps the values set in between", async () => {
        await migration.up(wrapper());
        await runSQL(wrapper(), `UPDATE project SET filtered_project = 1, time_duration_check = 0 WHERE project_id = 1;`);
        await runSQL(wrapper(), `UPDATE sample SET min_pressure = -7.5 WHERE sample_id = 1;`);

        await migration.up(wrapper());

        expect(await allSQL(wrapper(), `SELECT filtered_project, time_duration_check FROM project;`)).toEqual([{ filtered_project: 1, time_duration_check: 0 }]);
        expect(await allSQL(wrapper(), `SELECT min_pressure FROM sample;`)).toEqual([{ min_pressure: -7.5 }]);
    });

    test("down removes the three columns", async () => {
        await migration.up(wrapper());
        await migration.down(wrapper());

        expect(await columns("project")).toEqual(["project_id", "project_title"]);
        expect(await columns("sample")).toEqual(["sample_id", "sample_name", "max_pressure"]);
    });
});
