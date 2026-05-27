import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

export const migration: Migration = {
    id: "006_add_export_raw_task_type",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, "INSERT OR IGNORE INTO task_type (task_type_label) VALUES (?);", ["EXPORT_RAW"]);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, "DELETE FROM task_type WHERE task_type_label = ?;", ["EXPORT_RAW"]);
    },
};
