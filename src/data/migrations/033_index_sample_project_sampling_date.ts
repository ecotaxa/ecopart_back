import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Every project listing reads its oldest sampling date (start of the privacy delays): without this
// index each project would scan the whole sample table.
export const migration: Migration = {
    id: "033_index_sample_project_sampling_date",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `CREATE INDEX IF NOT EXISTS idx_sample_project_sampling_date ON sample (project_id, sampling_utc_date_time);`);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `DROP INDEX IF EXISTS idx_sample_project_sampling_date;`);
    },
};
