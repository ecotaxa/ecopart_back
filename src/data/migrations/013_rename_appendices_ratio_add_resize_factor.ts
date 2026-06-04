import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Two distinct ratio fields per Marc's spec:
//   - instrument_settings_acq_appendices_ratio  (RENAMED)
//       → instrument_settings_acq_vignette_roi_enlargement_ratio
//     UVP5 HDR `Ratio`, UVP6 ACQ_CONF.Appendices_ratio — crop window enlargement around the ROI.
//   - instrument_settings_process_vignette_resize_factor  (NEW)
//     UVP5 process_install_config (2 for UVP5SD, 1 for UVP5HD); UVP6 compute_vignettes scale factor.

function tableColumns(db: SQLiteDatabaseWrapper, table: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${table});`, [], (err, rows) => {
            if (err) reject(err);
            else resolve((rows ?? []).map((r: any) => r.name as string));
        });
    });
}

export const migration: Migration = {
    id: "013_rename_appendices_ratio_add_resize_factor",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        if (cols.includes("instrument_settings_acq_appendices_ratio")
            && !cols.includes("instrument_settings_acq_vignette_roi_enlargement_ratio")) {
            await runSQL(db, `ALTER TABLE sample RENAME COLUMN instrument_settings_acq_appendices_ratio TO instrument_settings_acq_vignette_roi_enlargement_ratio;`);
        }
        if (!cols.includes("instrument_settings_process_vignette_resize_factor")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN instrument_settings_process_vignette_resize_factor INTEGER;`);
        }
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        if (cols.includes("instrument_settings_process_vignette_resize_factor")) {
            await runSQL(db, `ALTER TABLE sample DROP COLUMN instrument_settings_process_vignette_resize_factor;`);
        }
        if (cols.includes("instrument_settings_acq_vignette_roi_enlargement_ratio")
            && !cols.includes("instrument_settings_acq_appendices_ratio")) {
            await runSQL(db, `ALTER TABLE sample RENAME COLUMN instrument_settings_acq_vignette_roi_enlargement_ratio TO instrument_settings_acq_appendices_ratio;`);
        }
    },
};
