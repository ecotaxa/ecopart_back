import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

export const migration: Migration = {
    id: "003_add_ctd_imported_to_sample",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `ALTER TABLE sample ADD COLUMN ctd_imported BOOLEAN NOT NULL DEFAULT 0;`);
        await runSQL(db, `ALTER TABLE sample ADD COLUMN ctd_station_id TEXT;`);
        await runSQL(db, `ALTER TABLE sample ADD COLUMN ctd_file_extension TEXT;`);
        await runSQL(db, `ALTER TABLE sample ADD COLUMN ctd_import_date TEXT;`);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {

    },
};
