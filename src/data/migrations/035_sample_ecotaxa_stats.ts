import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// EcoTaxa classification counts of each sample, as last read from EcoTaxa (sample_set/taxo_stats), so
// that the Explore page serves them from here and asks EcoTaxa at most once a day per sample.
export const migration: Migration = {
    id: "035_sample_ecotaxa_stats",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS sample_ecotaxa_stats (
                sample_id INTEGER PRIMARY KEY,
                ecotaxa_sample_id INTEGER NOT NULL,
                nb_unclassified INTEGER NOT NULL,
                nb_validated INTEGER NOT NULL,
                nb_dubious INTEGER NOT NULL,
                nb_predicted INTEGER NOT NULL,
                used_taxa TEXT NOT NULL,
                fetched_utc_date_time TEXT NOT NULL,
                FOREIGN KEY (sample_id) REFERENCES sample(sample_id) ON DELETE CASCADE
            );
        `);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, "DROP TABLE IF EXISTS sample_ecotaxa_stats;");
    },
};
