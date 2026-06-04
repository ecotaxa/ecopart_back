import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Renames two sample columns to a clearer snake-case form (single-word "xsize"/"ysize"
// → two-word "x_size"/"y_size"), matching Marc's spec for the export.

function tableColumns(db: SQLiteDatabaseWrapper, table: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${table});`, [], (err, rows) => {
            if (err) reject(err);
            else resolve((rows ?? []).map((r: any) => r.name as string));
        });
    });
}

export const migration: Migration = {
    id: "015_rename_sample_acq_xsize_ysize",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        if (cols.includes("instrument_settings_acq_xsize") && !cols.includes("instrument_settings_acq_x_size")) {
            await runSQL(db, `ALTER TABLE sample RENAME COLUMN instrument_settings_acq_xsize TO instrument_settings_acq_x_size;`);
        }
        if (cols.includes("instrument_settings_acq_ysize") && !cols.includes("instrument_settings_acq_y_size")) {
            await runSQL(db, `ALTER TABLE sample RENAME COLUMN instrument_settings_acq_ysize TO instrument_settings_acq_y_size;`);
        }
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        if (cols.includes("instrument_settings_acq_y_size") && !cols.includes("instrument_settings_acq_ysize")) {
            await runSQL(db, `ALTER TABLE sample RENAME COLUMN instrument_settings_acq_y_size TO instrument_settings_acq_ysize;`);
        }
        if (cols.includes("instrument_settings_acq_x_size") && !cols.includes("instrument_settings_acq_xsize")) {
            await runSQL(db, `ALTER TABLE sample RENAME COLUMN instrument_settings_acq_x_size TO instrument_settings_acq_xsize;`);
        }
    },
};
