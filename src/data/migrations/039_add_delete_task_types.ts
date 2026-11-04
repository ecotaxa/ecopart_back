import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

const ADDED_TYPES = ["DELETE_SAMPLE", "DELETE_PROJECT"];
// The id this migration shipped with (v0.0.105, v0.0.106): the same number as 038_qc_spec_alignment.
const FORMER_ID = "038_add_delete_task_types";

// Sample and project deletions run as tasks, with their own log.
export const migration: Migration = {
    id: "039_add_delete_task_types",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        for (const type of ADDED_TYPES) {
            await runSQL(db, "INSERT OR IGNORE INTO task_type (task_type_label) VALUES (?);", [type]);
        }
        // A database migrated under the former id runs this step again (harmless) and would keep a
        // record no file matches any more: removed so that the migration status stays exact.
        await runSQL(db, "DELETE FROM '_migrations' WHERE id = ?;", [FORMER_ID]);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        // A type still referenced by a task is kept: there is no meaningful type to move it to.
        const placeholders = ADDED_TYPES.map(() => "?").join(", ");
        await runSQL(db, `DELETE FROM task_type
            WHERE task_type_label IN (${placeholders})
            AND task_type_id NOT IN (SELECT task_type_id FROM task);`, ADDED_TYPES);
    },
};
