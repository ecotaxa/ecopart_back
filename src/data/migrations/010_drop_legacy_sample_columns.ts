import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Drops three columns that the codebase no longer uses:
//   - instrument_settings_acq_shutter         : never populated by any UVP5/UVP6 parser
//   - instrument_settings_particle_minimum_size_esd  : user decision after spec review
//   - instrument_settings_vignettes_minimum_size_esd : same — area-pixels columns are canonical

function tableColumns(db: SQLiteDatabaseWrapper, table: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${table});`, [], (err, rows) => {
            if (err) reject(err);
            else resolve((rows ?? []).map((r: any) => r.name as string));
        });
    });
}

const COLUMNS_TO_DROP = [
    "instrument_settings_acq_shutter",
    "instrument_settings_particle_minimum_size_esd",
    "instrument_settings_vignettes_minimum_size_esd",
];

export const migration: Migration = {
    id: "010_drop_legacy_sample_columns",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        for (const col of COLUMNS_TO_DROP) {
            if (cols.includes(col)) await runSQL(db, `ALTER TABLE sample DROP COLUMN ${col};`);
        }
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        if (!cols.includes("instrument_settings_acq_shutter")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN instrument_settings_acq_shutter INTEGER;`);
        }
        if (!cols.includes("instrument_settings_particle_minimum_size_esd")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN instrument_settings_particle_minimum_size_esd INTEGER;`);
        }
        if (!cols.includes("instrument_settings_vignettes_minimum_size_esd")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN instrument_settings_vignettes_minimum_size_esd INTEGER;`);
        }
    },
};
