import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// EcoTaxa `/api/token` returns a short-lived access token (kept in ecotaxa_account_token) and a single-use
// refresh token, rotated by `/api/token/refresh`. NULL for the accounts logged in with the former `/api/login`
// token: they keep working until that token expires, then their owner logs in again.
export const migration: Migration = {
    id: "046_ecotaxa_account_refresh_token",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `ALTER TABLE ecotaxa_account ADD COLUMN ecotaxa_account_refresh_token TEXT NULL;`);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `ALTER TABLE ecotaxa_account DROP COLUMN ecotaxa_account_refresh_token;`);
    },
};
