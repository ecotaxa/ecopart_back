import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Adds the legacy-EcoPart migration tracking columns to the user table:
//  - legacy_ecopart_user_id : the old EcoPart user id (its presence flags a migrated user)
//  - legacy_password_set     : NULL for normal users, 0 = migrated/password not set yet,
//                              1 = the migrated user has set their new password

function tableColumns(db: SQLiteDatabaseWrapper, table: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${table});`, [], (err, rows) => {
            if (err) reject(err);
            else resolve((rows ?? []).map((r: any) => r.name as string));
        });
    });
}

export const migration: Migration = {
    id: "019_add_legacy_ecopart_user_fields",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "user");
        if (!cols.includes("legacy_ecopart_user_id")) {
            await runSQL(db, `ALTER TABLE user ADD COLUMN legacy_ecopart_user_id INTEGER;`);
        }
        if (!cols.includes("legacy_password_set")) {
            await runSQL(db, `ALTER TABLE user ADD COLUMN legacy_password_set BOOLEAN CHECK (legacy_password_set IN (0, 1)) DEFAULT NULL;`);
        }
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "user");
        if (cols.includes("legacy_password_set")) {
            await runSQL(db, `ALTER TABLE user DROP COLUMN legacy_password_set;`);
        }
        if (cols.includes("legacy_ecopart_user_id")) {
            await runSQL(db, `ALTER TABLE user DROP COLUMN legacy_ecopart_user_id;`);
        }
    },
};
