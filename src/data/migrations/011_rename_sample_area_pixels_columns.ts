import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Renames two sample columns to reflect that the stored value is an AREA in pixels², not a length.
//   instrument_settings_particle_minimum_size_pixels   → instrument_settings_particule_minimum_area_pixels
//   instrument_settings_vignettes_minimum_size_pixels  → instrument_settings_vignette_minimum_area_pixels
// Also matches the spec spelling ("particule" / "vignette" — singular, French).

function tableColumns(db: SQLiteDatabaseWrapper, table: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${table});`, [], (err, rows) => {
            if (err) reject(err);
            else resolve((rows ?? []).map((r: any) => r.name as string));
        });
    });
}

export const migration: Migration = {
    id: "011_rename_sample_area_pixels_columns",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        if (cols.includes("instrument_settings_particle_minimum_size_pixels")
            && !cols.includes("instrument_settings_particule_minimum_area_pixels")) {
            await runSQL(db, `ALTER TABLE sample RENAME COLUMN instrument_settings_particle_minimum_size_pixels TO instrument_settings_particule_minimum_area_pixels;`);
        }
        if (cols.includes("instrument_settings_vignettes_minimum_size_pixels")
            && !cols.includes("instrument_settings_vignette_minimum_area_pixels")) {
            await runSQL(db, `ALTER TABLE sample RENAME COLUMN instrument_settings_vignettes_minimum_size_pixels TO instrument_settings_vignette_minimum_area_pixels;`);
        }
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        if (cols.includes("instrument_settings_vignette_minimum_area_pixels")
            && !cols.includes("instrument_settings_vignettes_minimum_size_pixels")) {
            await runSQL(db, `ALTER TABLE sample RENAME COLUMN instrument_settings_vignette_minimum_area_pixels TO instrument_settings_vignettes_minimum_size_pixels;`);
        }
        if (cols.includes("instrument_settings_particule_minimum_area_pixels")
            && !cols.includes("instrument_settings_particle_minimum_size_pixels")) {
            await runSQL(db, `ALTER TABLE sample RENAME COLUMN instrument_settings_particule_minimum_area_pixels TO instrument_settings_particle_minimum_size_pixels;`);
        }
    },
};
