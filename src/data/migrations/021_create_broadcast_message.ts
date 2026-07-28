import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Single application-wide broadcast message shown to every user in the front-end.
// The app holds at most one message at a time, so the primary key is pinned to 1
// (CHECK) and set = INSERT OR REPLACE on that single row.
export const migration: Migration = {
    id: "021_create_broadcast_message",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS broadcast_message (
                broadcast_message_id INTEGER PRIMARY KEY CHECK (broadcast_message_id = 1),
                message TEXT NOT NULL,
                sub_message TEXT,
                level TEXT NOT NULL,
                created_by_user_id INTEGER,
                message_creation_utc_date_time TEXT NOT NULL,
                FOREIGN KEY (created_by_user_id) REFERENCES user (user_id)
            );
        `);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `DROP TABLE IF EXISTS broadcast_message;`);
    },
};
