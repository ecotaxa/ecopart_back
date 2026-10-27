import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Per-user notifications (e.g. "your import is finished"). The task and the project are only links:
// deleting them keeps the notification, its message already names what it was about.
export const migration: Migration = {
    id: "036_create_notification",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS notification (
                notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                notification_type TEXT NOT NULL,
                notification_message TEXT NOT NULL,
                task_id INTEGER,
                project_id INTEGER,
                is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
                notification_creation_utc_date_time TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
                FOREIGN KEY (task_id) REFERENCES task(task_id) ON DELETE SET NULL,
                FOREIGN KEY (project_id) REFERENCES project(project_id) ON DELETE SET NULL
            );
        `);
        await runSQL(db, `CREATE INDEX IF NOT EXISTS idx_notification_user_read ON notification (user_id, is_read);`);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `DROP INDEX IF EXISTS idx_notification_user_read;`);
        await runSQL(db, `DROP TABLE IF EXISTS notification;`);
    },
};
