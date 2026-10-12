import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

function tableColumns(db: SQLiteDatabaseWrapper, table: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${table});`, [], (err, rows) => {
            if (err) reject(err);
            else resolve((rows ?? []).map((r: any) => r.name as string));
        });
    });
}

const REMOVED_STATUSES = ["VALIDATING", "WAITING_FOR_RESPONSE"];
const ADDED_STATUSES = ["CANCELLING", "CANCELLED"];
const REMOVED_TYPES = ["DELETE", "UPDATE"];
const REMOVED_COLUMNS: [string, string][] = [
    ["task_question", "TEXT"],
    ["task_reply", "TEXT"],
    ["task_step", "INTEGER DEFAULT 0"],
];

// Adds the cancellation statuses and removes what no task type ever used: the VALIDATING and
// WAITING_FOR_RESPONSE statuses, the DELETE and UPDATE types, and the question/reply/step columns.
export const migration: Migration = {
    id: "028_task_cancellation_and_unused_cleanup",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        for (const status of ADDED_STATUSES) {
            await runSQL(db, "INSERT OR IGNORE INTO task_status (task_status_label) VALUES (?);", [status]);
        }

        // No task can be in a removed status (nothing ever set them); a stray one is failed rather
        // than left pointing at a deleted status row.
        const removed_status_placeholders = REMOVED_STATUSES.map(() => "?").join(", ");
        await runSQL(db, `UPDATE task
            SET task_status_id = (SELECT task_status_id FROM task_status WHERE task_status_label = 'ERROR'),
                task_error = COALESCE(task_error, 'Task status removed by migration 028')
            WHERE task_status_id IN (SELECT task_status_id FROM task_status WHERE task_status_label IN (${removed_status_placeholders}));`, REMOVED_STATUSES);
        await runSQL(db, `DELETE FROM task_status WHERE task_status_label IN (${removed_status_placeholders});`, REMOVED_STATUSES);

        // A type still referenced by a task is kept: there is no meaningful type to move it to.
        const removed_type_placeholders = REMOVED_TYPES.map(() => "?").join(", ");
        await runSQL(db, `DELETE FROM task_type
            WHERE task_type_label IN (${removed_type_placeholders})
            AND task_type_id NOT IN (SELECT task_type_id FROM task);`, REMOVED_TYPES);

        const cols = await tableColumns(db, "task");
        for (const [col] of REMOVED_COLUMNS) {
            if (cols.includes(col)) await runSQL(db, `ALTER TABLE task DROP COLUMN ${col};`);
        }
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "task");
        for (const [col, definition] of REMOVED_COLUMNS) {
            if (!cols.includes(col)) await runSQL(db, `ALTER TABLE task ADD COLUMN ${col} ${definition};`);
        }

        for (const type of REMOVED_TYPES) {
            await runSQL(db, "INSERT OR IGNORE INTO task_type (task_type_label) VALUES (?);", [type]);
        }
        for (const status of REMOVED_STATUSES) {
            await runSQL(db, "INSERT OR IGNORE INTO task_status (task_status_label) VALUES (?);", [status]);
        }

        // The previous schema has no cancellation: a cancelled or cancelling task becomes a failed one.
        const added_status_placeholders = ADDED_STATUSES.map(() => "?").join(", ");
        await runSQL(db, `UPDATE task
            SET task_status_id = (SELECT task_status_id FROM task_status WHERE task_status_label = 'ERROR'),
                task_error = COALESCE(task_error, 'Task cancelled')
            WHERE task_status_id IN (SELECT task_status_id FROM task_status WHERE task_status_label IN (${added_status_placeholders}));`, ADDED_STATUSES);
        await runSQL(db, `DELETE FROM task_status WHERE task_status_label IN (${added_status_placeholders});`, ADDED_STATUSES);
    },
};
