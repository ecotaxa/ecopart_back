import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Existing rows created before this release have SQLite's DEFAULT CURRENT_TIMESTAMP
// format ("YYYY-MM-DD HH:MM:SS"). Convert them to proper ISO 8601 UTC
// ("YYYY-MM-DDTHH:MM:SSZ") in place. New rows are written directly as ISO via
// `new Date().toISOString()` in the data sources.

// Selector: matches "YYYY-MM-DD HH:MM:SS" rows that don't already end in Z.
// SQLite GLOB pattern: 4 digits, dash, 2 digits, dash, 2 digits, space, 2 digits, colon, 2, colon, 2.
const SQLITE_TIMESTAMP_GLOB = "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]";

const TARGETS: Array<[string, string]> = [
    // [table, column]
    ["sample", "sample_creation_utc_date_time"],
    ["project", "project_creation_utc_date_time"],
    ["task", "task_creation_utc_date_time"],
    ["user", "user_creation_utc_date_time"],
    ["privilege", "privilege_creation_utc_date_time"],
    ["ecotaxa_instance", "ecotaxa_instance_creation_utc_date_time"],
    ["ecotaxa_account", "ecotaxa_account_creation_utc_date_time"],
    ["instrument_model", "instrument_model_creation_utc_date_time"],
];

export const migration: Migration = {
    id: "018_backfill_utc_date_time_iso_format",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        for (const [table, column] of TARGETS) {
            // Replace the space separator with `T` and append the `Z` UTC marker.
            await runSQL(
                db,
                `UPDATE ${table}
                    SET ${column} = REPLACE(${column}, ' ', 'T') || 'Z'
                  WHERE ${column} GLOB '${SQLITE_TIMESTAMP_GLOB}';`
            );
        }
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        // Best-effort reverse: strip the trailing Z and turn T back into a space.
        const ISO_GLOB = "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z";
        for (const [table, column] of TARGETS) {
            await runSQL(
                db,
                `UPDATE ${table}
                    SET ${column} = REPLACE(SUBSTR(${column}, 1, LENGTH(${column}) - 1), 'T', ' ')
                  WHERE ${column} GLOB '${ISO_GLOB}';`
            );
        }
    },
};
