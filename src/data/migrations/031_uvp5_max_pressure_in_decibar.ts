import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// `max_pressure` was stored raw: centibar on the UVP5 (max of the datfile pressure column, 822)
// but decibar on the UVP6 (`particules.csv`, 29.84). The UVP5 import now divides it by 10 (its
// `instrument_settings_acq_pressure_gain` is 0.1); this converts the UVP5 samples imported before.
// Divided rather than multiplied by 0.1, which leaves float noise (9894 × 0.1 = 989.4000000000001).
//
// Unlike the pixel size, a value in centibar cannot be told apart from one already in decibar, so
// `up` is not safe to run twice by itself: it relies on `_migrations`, which runs it exactly once
// inside a transaction. The datfile pressures are integers, so `down` restores them exactly.
const UVP5_SAMPLES = `
    project_id IN (
        SELECT p.project_id
          FROM project p
          JOIN instrument_model im ON im.instrument_model_id = p.instrument_model
         WHERE im.instrument_model_name LIKE 'UVP5%'
    )
`;

export const migration: Migration = {
    id: "031_uvp5_max_pressure_in_decibar",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `
            UPDATE sample
               SET max_pressure = max_pressure / 10.0
             WHERE max_pressure IS NOT NULL
               AND ${UVP5_SAMPLES};
        `);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, `
            UPDATE sample
               SET max_pressure = CAST(ROUND(max_pressure * 10) AS INTEGER)
             WHERE max_pressure IS NOT NULL
               AND ${UVP5_SAMPLES};
        `);
    },
};
