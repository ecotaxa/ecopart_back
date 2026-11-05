import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// UVPapp writes `NA` or `nan` in `metadata.ini` when the operator leaves an environment field empty, and
// the UVP6 import stored that text as is: the exports then showed `nan` in `environment_*`. The import
// now stores NULL; this clears the text left by the samples imported before. Only a text cell that is
// blank or reads `NA` / `nan` changes, so `up` is safe to run twice.
const COLUMNS = ["wind_direction", "wind_speed", "sea_state", "nebulousness", "bottom_depth"];

export const migration: Migration = {
    id: "041_sample_environment_placeholders_to_null",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        for (const column of COLUMNS) {
            await runSQL(db, `
                UPDATE sample
                   SET ${column} = NULL
                 WHERE typeof(${column}) = 'text'
                   AND lower(trim(${column})) IN ('', 'na', 'nan');
            `);
        }
    },

    // Not reversible: nothing tells which NULL was a placeholder text, and an absent value is NULL anyway.
    async down(): Promise<void> {
        return;
    },
};
