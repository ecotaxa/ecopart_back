import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// One row per login session. A refresh token carries its session id and is refused once the session is
// revoked (logout, password change or reset) or expired, so a stolen refresh token can be cut off.
export const migration: Migration = {
    id: "029_create_user_session",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS user_session (
                session_id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                session_creation_utc_date_time TEXT NOT NULL,
                session_expiration_utc_date_time TEXT NOT NULL,
                session_revocation_utc_date_time TEXT,
                FOREIGN KEY (user_id) REFERENCES user (user_id) ON DELETE CASCADE
            );
        `);
        await runSQL(db, `CREATE INDEX IF NOT EXISTS idx_user_session_user_id ON user_session (user_id);`);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `DROP INDEX IF EXISTS idx_user_session_user_id;`);
        await runSQL(db, `DROP TABLE IF EXISTS user_session;`);
    },
};
