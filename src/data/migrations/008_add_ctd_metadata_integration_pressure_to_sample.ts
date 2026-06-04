import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

function tableColumns(db: SQLiteDatabaseWrapper, table: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${table});`, [], (err, rows) => {
            if (err) reject(err);
            else resolve((rows ?? []).map((r: any) => r.name as string));
        });
    });
}

export const migration: Migration = {
    id: "008_add_ctd_metadata_integration_pressure_to_sample",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");

        if (!cols.includes("ctd_original_file_name")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN ctd_original_file_name TEXT;`);
        }
        if (!cols.includes("ctd_imported_file_name")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN ctd_imported_file_name TEXT;`);
        }
        if (!cols.includes("ctd_importator_user_id")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN ctd_importator_user_id INTEGER REFERENCES user(user_id);`);
        }
        if (!cols.includes("ctd_latitude")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN ctd_latitude REAL;`);
        }
        if (!cols.includes("ctd_longitude")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN ctd_longitude REAL;`);
        }
        if (!cols.includes("instrument_settings_integration_time")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN instrument_settings_integration_time INTEGER;`);
        }
        if (!cols.includes("instrument_settings_acq_pressure_gain")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN instrument_settings_acq_pressure_gain REAL;`);
        }
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        for (const col of [
            "instrument_settings_acq_pressure_gain",
            "instrument_settings_integration_time",
            "ctd_longitude",
            "ctd_latitude",
            "ctd_importator_user_id",
            "ctd_imported_file_name",
            "ctd_original_file_name",
        ]) {
            if (cols.includes(col)) await runSQL(db, `ALTER TABLE sample DROP COLUMN ${col};`);
        }
    },
};
