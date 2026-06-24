import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Marc confirmed the import code had `instrument_settings_acq_shutter_speed` and
// `instrument_settings_acq_exposure` crossed:
//   - acq_shutter_speed was being filled from HDR `Exposure`     (UVP5HD shutter in µs)
//   - acq_exposure      was being filled from HDR `ShutterSpeed` (UVP5SD code, e.g. `12`)
// Per spec it should be the opposite. The import code has been swapped; this migration
// fixes the already-stored rows by swapping their two values in a single UPDATE.
//
// Note: SQLite's UPDATE evaluates ALL right-hand expressions against the original row
// before any assignment is applied, so `SET a = b, b = a` swaps correctly without a
// temporary.

export const migration: Migration = {
    id: "019_swap_sample_acq_shutter_speed_exposure",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `
            UPDATE sample
               SET instrument_settings_acq_shutter_speed = instrument_settings_acq_exposure,
                   instrument_settings_acq_exposure       = instrument_settings_acq_shutter_speed;
        `);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        // Reverse swap (same operation).
        await runSQL(db, `
            UPDATE sample
               SET instrument_settings_acq_shutter_speed = instrument_settings_acq_exposure,
                   instrument_settings_acq_exposure       = instrument_settings_acq_shutter_speed;
        `);
    },
};
