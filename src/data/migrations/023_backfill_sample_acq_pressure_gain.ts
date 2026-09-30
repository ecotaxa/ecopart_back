import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// `instrument_settings_acq_pressure_gain` is the multiplicative factor converting the raw
// pressure of the LPM data files to decibar. It is an instrument constant, confirmed against
// legacy EcoPart (`py/part_app/funcs/uvp_sample_import.py`, GenerateRawHistogram:
// `depth = raw * 0.1 + depth_offset` for the UVP5, no factor for the UVP6):
//   - UVP5 stores centibar → 0.1
//   - UVP6 stores decibar  → 1
// Samples imported before the constant was wired in at import time have it NULL, so the raw
// export shipped an empty column for them. This backfills those rows from the project's
// instrument model; rows that already carry a value are left untouched (a manual correction
// through the sample edition must win over a blanket update).
const BACKFILL_SQL = `
    UPDATE sample
       SET instrument_settings_acq_pressure_gain = (
               SELECT CASE
                          WHEN im.instrument_model_name LIKE 'UVP5%' THEN 0.1
                          WHEN im.instrument_model_name LIKE 'UVP6%' THEN 1
                      END
                 FROM project p
                 JOIN instrument_model im ON im.instrument_model_id = p.instrument_model
                WHERE p.project_id = sample.project_id
           )
     WHERE instrument_settings_acq_pressure_gain IS NULL
       AND EXISTS (
               SELECT 1
                 FROM project p
                 JOIN instrument_model im ON im.instrument_model_id = p.instrument_model
                WHERE p.project_id = sample.project_id
                  AND (im.instrument_model_name LIKE 'UVP5%' OR im.instrument_model_name LIKE 'UVP6%')
           );
`;

export const migration: Migration = {
    id: "023_backfill_sample_acq_pressure_gain",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, BACKFILL_SQL);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        // Irreversible by design: the pre-migration state was "NULL for some rows, and we cannot
        // tell which ones were NULL from the ones legitimately filled at import". Clearing every
        // gain would lose data the import now provides, so `down` is a no-op.
    },
};
