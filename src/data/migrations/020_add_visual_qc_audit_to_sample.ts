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

// QC audit trail: who validated (existing visual_qc_validator_user_id), plus when and a
// free-text comment. Both new columns are nullable — visual_qc_validation_utc_date_time being
// NULL is the "never reviewed" signal (the validator column is NOT NULL and pre-set to the
// importer at import time, so it alone can't distinguish reviewed from not).
export const migration: Migration = {
    id: "020_add_visual_qc_audit_to_sample",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        if (!cols.includes("visual_qc_comment")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN visual_qc_comment TEXT;`);
        }
        if (!cols.includes("visual_qc_validation_utc_date_time")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN visual_qc_validation_utc_date_time TEXT;`);
        }
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        if (cols.includes("visual_qc_validation_utc_date_time")) await runSQL(db, `ALTER TABLE sample DROP COLUMN visual_qc_validation_utc_date_time;`);
        if (cols.includes("visual_qc_comment")) await runSQL(db, `ALTER TABLE sample DROP COLUMN visual_qc_comment;`);
    },
};
