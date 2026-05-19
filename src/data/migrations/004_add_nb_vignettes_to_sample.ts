import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

export const migration: Migration = {
    id: "004_add_nb_vignettes_to_sample",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `ALTER TABLE sample ADD COLUMN nb_vignettes INTEGER NOT NULL DEFAULT 0;`);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {

    },
};
