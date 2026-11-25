import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// The EcoTaxa objects of each sample counted per category and 5 m depth bin, read once in the
// background, so that the Explore EcoTaxa concentrations never wait for EcoTaxa. `bins` is a JSON
// array of [classif_id, depth_bin, nb_validated, nb_predicted]; the other columns say what the
// reading depended on, so that a change of the offset or of the classification asks for a new one.
export const migration: Migration = {
    id: "043_sample_ecotaxa_histogram",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS sample_ecotaxa_histogram (
                sample_id INTEGER PRIMARY KEY,
                ecotaxa_sample_id INTEGER NOT NULL,
                depth_offset_m REAL NOT NULL,
                nb_validated INTEGER NOT NULL,
                nb_predicted INTEGER NOT NULL,
                bins TEXT NOT NULL,
                fetched_utc_date_time TEXT NOT NULL,
                FOREIGN KEY (sample_id) REFERENCES sample(sample_id) ON DELETE CASCADE
            );
        `);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, "DROP TABLE IF EXISTS sample_ecotaxa_histogram;");
    },
};
