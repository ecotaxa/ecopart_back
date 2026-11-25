import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// The expired log of a successful task is reduced to its warnings, or removed, once
// (TaskRepository.purgeExpiredLogs): the date it was done marks the tasks the daily purge has no more work on.
export const migration: Migration = {
    id: "042_task_log_purged",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        const columns = await new Promise<{ name: string }[]>((resolve, reject) =>
            db.all("PRAGMA table_info(task);", [], (err, rows) => err ? reject(err) : resolve(rows as { name: string }[])));
        if (!columns.some(column => column.name === "task_log_purged_utc_date_time")) {
            await runSQL(db, "ALTER TABLE task ADD COLUMN task_log_purged_utc_date_time TEXT;");
        }
    },

    // The logs already reduced or removed stay so: the purge finds nothing more to take from them.
    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, "ALTER TABLE task DROP COLUMN task_log_purged_utc_date_time;");
    },
};
