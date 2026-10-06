import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

export const migration: Migration = {
    id: "026_add_regenerate_pivot_task_type",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, "INSERT OR IGNORE INTO task_type (task_type_label) VALUES (?);", ["REGENERATE_PIVOT"]);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, "DELETE FROM task_type WHERE task_type_label = ?;", ["REGENERATE_PIVOT"]);
    },
};
