import sqlite3 from "sqlite3";
import fs from "fs";

import { SQLiteDatabaseWrapper } from "../../../src/data/interfaces/data-sources/database-wrapper";
import { MigrationManager } from "../../../src/data/migrations/migration-manager";
import { migration } from "../../../src/data/migrations/039_add_delete_task_types";

const TEST_DB = "TEST_DB_ADD_DELETE_TASK_TYPES_MIGRATION";
// The id the migration shipped with, recorded on the databases migrated by v0.0.105 and v0.0.106.
const FORMER_ID = "038_add_delete_task_types";

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
    await runSQL(wrapper(), `CREATE TABLE task_type (task_type_id INTEGER PRIMARY KEY AUTOINCREMENT, task_type_label TEXT NOT NULL UNIQUE);`);
    await runSQL(wrapper(), `CREATE TABLE task (task_id INTEGER PRIMARY KEY AUTOINCREMENT, task_type_id INTEGER NOT NULL REFERENCES task_type(task_type_id));`);
    await runSQL(wrapper(), `INSERT INTO task_type (task_type_label) VALUES ('EXPORT'), ('IMPORT');`);
});

afterEach(async () => {
    await new Promise<void>((resolve) => db.close(() => resolve()));
    try { fs.unlinkSync(TEST_DB); } catch { /* already gone, fine */ }
});

const labels = async () => (await allSQL<{ task_type_label: string }>(wrapper(), `SELECT task_type_label FROM task_type ORDER BY task_type_id;`)).map(row => row.task_type_label);
const applied = async () => (await allSQL<{ id: string }>(wrapper(), `SELECT id FROM '_migrations' ORDER BY id;`)).map(row => row.id);

describe("039_add_delete_task_types", () => {
    test("adds the two deletion task types after the existing ones", async () => {
        const manager = new MigrationManager(wrapper());

        expect(await manager.runMigrations([migration])).toEqual([migration.id]);

        expect(await labels()).toEqual(["EXPORT", "IMPORT", "DELETE_SAMPLE", "DELETE_PROJECT"]);
        expect(await applied()).toEqual([migration.id]);
    });

    test("a database migrated under the former id 038 runs it again without duplicating the types and forgets the former record", async () => {
        const manager = new MigrationManager(wrapper());
        await manager.ensureMigrationTable();
        await runSQL(wrapper(), `INSERT INTO task_type (task_type_label) VALUES ('DELETE_SAMPLE'), ('DELETE_PROJECT');`);
        await runSQL(wrapper(), `INSERT INTO '_migrations' (id) VALUES (?);`, [FORMER_ID]);

        expect(await manager.runMigrations([migration])).toEqual([migration.id]);

        expect(await labels()).toEqual(["EXPORT", "IMPORT", "DELETE_SAMPLE", "DELETE_PROJECT"]);
        expect(await applied()).toEqual([migration.id]);
        expect(await manager.runMigrations([migration])).toEqual([]);
    });

    test("down removes the types no task uses and keeps the one still referenced", async () => {
        const manager = new MigrationManager(wrapper());
        await manager.runMigrations([migration]);
        const [{ task_type_id }] = await allSQL<{ task_type_id: number }>(wrapper(), `SELECT task_type_id FROM task_type WHERE task_type_label = 'DELETE_PROJECT';`);
        await runSQL(wrapper(), `INSERT INTO task (task_type_id) VALUES (?);`, [task_type_id]);

        await migration.down(wrapper());

        expect(await labels()).toEqual(["EXPORT", "IMPORT", "DELETE_PROJECT"]);
    });
});
