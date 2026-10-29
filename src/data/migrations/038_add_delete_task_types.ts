import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

const ADDED_TYPES = ["DELETE_SAMPLE", "DELETE_PROJECT"];

// Sample and project deletions run as tasks, with their own log.
export const migration: Migration = {
    id: "038_add_delete_task_types",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        for (const type of ADDED_TYPES) {
            await runSQL(db, "INSERT OR IGNORE INTO task_type (task_type_label) VALUES (?);", [type]);
        }
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        // A type still referenced by a task is kept: there is no meaningful type to move it to.
        const placeholders = ADDED_TYPES.map(() => "?").join(", ");
        await runSQL(db, `DELETE FROM task_type
            WHERE task_type_label IN (${placeholders})
            AND task_type_id NOT IN (SELECT task_type_id FROM task);`, ADDED_TYPES);
    },
};
