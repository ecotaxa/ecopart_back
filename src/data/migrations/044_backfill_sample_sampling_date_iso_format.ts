import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Samples imported before the import wrote ISO dates kept the UVP formats in sampling_utc_date_time:
// "20120520080213" (UVP5) and "20230406-144332-820" (UVP6). Explore and the STATS tab converted them
// on the fly, while the privacy rule (oldest sample of the project) only read ISO dates: a project
// holding only such samples stayed private whatever its delays. They are rewritten once as ISO UTC
// date-times, so that every query reads the plain column.
const D = (n: number) => "[0-9]".repeat(n);
const part = (start: number, length: number) => `substr(sampling_utc_date_time, ${start}, ${length})`;

export const migration: Migration = {
    id: "044_backfill_sample_sampling_date_iso_format",

    // Idempotent: a converted date matches neither pattern.
    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `UPDATE sample
            SET sampling_utc_date_time = ${part(1, 4)} || '-' || ${part(5, 2)} || '-' || ${part(7, 2)} || 'T' || ${part(9, 2)} || ':' || ${part(11, 2)} || ':' || ${part(13, 2)} || 'Z'
            WHERE sampling_utc_date_time GLOB '${D(14)}*';`);
        await runSQL(db, `UPDATE sample
            SET sampling_utc_date_time = ${part(1, 4)} || '-' || ${part(5, 2)} || '-' || ${part(7, 2)} || 'T' || ${part(10, 2)} || ':' || ${part(12, 2)} || ':' || ${part(14, 2)} || 'Z'
            WHERE sampling_utc_date_time GLOB '${D(8)}-${D(6)}*';`);
    },

    // Not reversed: nothing reads the former formats any more, and which of the two a date came from
    // is not kept.
    async down(): Promise<void> {
        return;
    },
};
