import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Backfill instrument_settings_process_vignette_resize_factor from existing data.
//
// UVP5SD → 2, UVP5HD → 1 (per Marc's spec — constants).
// UVP6 → would re-read compute_vignettes.txt from disk; out of scope for an in-DB migration.
//        Those rows stay NULL and will be filled by re-imports or a future on-disk backfill.
//
// The project.instrument_model column stores the model NAME (e.g. "UVP5SD", "UVP5HD", "UVP6LP")
// resolved via the instrument_model lookup table.

export const migration: Migration = {
    id: "014_backfill_process_vignette_resize_factor",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `
            UPDATE sample
               SET instrument_settings_process_vignette_resize_factor = 2
             WHERE instrument_settings_process_vignette_resize_factor IS NULL
               AND project_id IN (
                   SELECT p.project_id FROM project p
                   JOIN instrument_model im ON im.instrument_model_id = p.instrument_model
                   WHERE im.instrument_model_name = 'UVP5SD'
               );
        `);
        await runSQL(db, `
            UPDATE sample
               SET instrument_settings_process_vignette_resize_factor = 1
             WHERE instrument_settings_process_vignette_resize_factor IS NULL
               AND project_id IN (
                   SELECT p.project_id FROM project p
                   JOIN instrument_model im ON im.instrument_model_id = p.instrument_model
                   WHERE im.instrument_model_name = 'UVP5HD'
               );
        `);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `UPDATE sample SET instrument_settings_process_vignette_resize_factor = NULL;`);
    },
};
