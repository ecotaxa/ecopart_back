import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// `instrument_settings_pixel_size_mm` was stored raw: mm on the UVP5 (0.118) but µm on the UVP6, whose
// `metadata.ini` `HW_CONF.Pixel_Size` is 73. The UVP6 import now divides it by 1000; this converts the
// UVP6 samples imported before. A UVP pixel side is far below 1 mm, so only values above 1 are µm, which
// makes `up` safe to run twice and leaves the rows imported with the new code alone.
const UVP6_SAMPLES = `
    project_id IN (
        SELECT p.project_id
          FROM project p
          JOIN instrument_model im ON im.instrument_model_id = p.instrument_model
         WHERE im.instrument_model_name LIKE 'UVP6%'
    )
`;

export const migration: Migration = {
    id: "030_uvp6_pixel_size_in_mm",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `
            UPDATE sample
               SET instrument_settings_pixel_size_mm = instrument_settings_pixel_size_mm / 1000.0
             WHERE instrument_settings_pixel_size_mm > 1
               AND ${UVP6_SAMPLES};
        `);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `
            UPDATE sample
               SET instrument_settings_pixel_size_mm = instrument_settings_pixel_size_mm * 1000
             WHERE instrument_settings_pixel_size_mm > 0
               AND instrument_settings_pixel_size_mm <= 1
               AND ${UVP6_SAMPLES};
        `);
    },
};
