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
//
// This first shipped as `019_swap_sample_acq_shutter_speed_exposure` on the export-raw
// branch, but `019` was already taken by `019_add_legacy_ecopart_user_fields` on main, so
// it was renumbered to `022`. Databases that ran the old id would otherwise swap a second
// time and undo the fix — hence the guard: the UPDATE is skipped when the legacy id is
// recorded in `_migrations`.
const LEGACY_ID = "019_swap_sample_acq_shutter_speed_exposure";

const SWAP_SQL = `
    UPDATE sample
       SET instrument_settings_acq_shutter_speed = instrument_settings_acq_exposure,
           instrument_settings_acq_exposure      = instrument_settings_acq_shutter_speed;
`;

function migrationAlreadyApplied(db: SQLiteDatabaseWrapper, id: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        db.all(`SELECT id FROM _migrations WHERE id = ?;`, [id], (err, rows) => {
            if (err) reject(err);
            else resolve((rows ?? []).length > 0);
        });
    });
}

export const migration: Migration = {
    id: "022_swap_sample_acq_shutter_speed_exposure",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        if (await migrationAlreadyApplied(db, LEGACY_ID)) return;
        await runSQL(db, SWAP_SQL);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        // Reverse swap (same operation). Also skipped when the legacy id did the swap, so
        // rolling this one back cannot cross the values on those databases either.
        if (await migrationAlreadyApplied(db, LEGACY_ID)) return;
        await runSQL(db, SWAP_SQL);
    },
};
