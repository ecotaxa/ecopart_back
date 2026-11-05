import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// `instrument_settings_aa` was stored raw: mm²/px on the UVP5 (0.0026) but mm²/px × 10⁶ on the UVP6,
// whose `metadata.ini` `HW_CONF.Aa` is 2300. The UVP6 import now divides it by 10⁶; this converts the
// UVP6 samples imported before. A UVP pixel is far below 1 mm², so only values above 1 are in the
// instrument's unit, which makes `up` safe to run twice and leaves the rows imported with the new code
// alone. The division matches the import's (`/ 1e6`) bit for bit, so the project statistics never see
// two values for one calibration.
const UVP6_SAMPLES = `
    project_id IN (
        SELECT p.project_id
          FROM project p
          JOIN instrument_model im ON im.instrument_model_id = p.instrument_model
         WHERE im.instrument_model_name LIKE 'UVP6%'
    )
`;

export const migration: Migration = {
    id: "040_uvp6_aa_in_mm2",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `
            UPDATE sample
               SET instrument_settings_aa = instrument_settings_aa / 1000000.0
             WHERE instrument_settings_aa > 1
               AND ${UVP6_SAMPLES};
        `);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `
            UPDATE sample
               SET instrument_settings_aa = instrument_settings_aa * 1000000
             WHERE instrument_settings_aa > 0
               AND instrument_settings_aa <= 1
               AND ${UVP6_SAMPLES};
        `);
    },
};
