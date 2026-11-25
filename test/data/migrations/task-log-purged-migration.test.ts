import sqlite3 from "sqlite3";

import { SQLiteDatabaseWrapper } from "../../../src/data/interfaces/data-sources/database-wrapper";
import { migration } from "../../../src/data/migrations/042_task_log_purged";

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
const columns = async () => (await allSQL<{ name: string }>(wrapper(), "PRAGMA table_info(task);")).map(column => column.name);

beforeEach(async () => {
    db = new sqlite3.Database(":memory:");
    await runSQL(wrapper(), "CREATE TABLE task (task_id INTEGER PRIMARY KEY AUTOINCREMENT, task_log_file_path TEXT, task_end_utc_date_time TEXT);");
    await runSQL(wrapper(), "INSERT INTO task (task_log_file_path, task_end_utc_date_time) VALUES ('tasks/1/task_log_1.log', '2026-01-01T00:00:00.000Z');");
});

afterEach(async () => {
    await new Promise<void>((resolve) => db.close(() => resolve()));
});

describe("042_task_log_purged", () => {
    test("up adds the purge date, empty for the existing tasks, and runs again cleanly : ok", async () => {
        await migration.up(wrapper());
        await migration.up(wrapper());

        expect(await columns()).toContain("task_log_purged_utc_date_time");
        expect(await allSQL(wrapper(), "SELECT task_id, task_log_purged_utc_date_time FROM task;")).toEqual([{ task_id: 1, task_log_purged_utc_date_time: null }]);
    });

    test("down removes it and keeps the tasks : ok", async () => {
        await migration.up(wrapper());
        await runSQL(wrapper(), "UPDATE task SET task_log_purged_utc_date_time = '2026-02-01T00:00:00.000Z';");

        await migration.down(wrapper());

        expect(await columns()).not.toContain("task_log_purged_utc_date_time");
        expect(await allSQL(wrapper(), "SELECT task_id FROM task;")).toEqual([{ task_id: 1 }]);
    });
});
