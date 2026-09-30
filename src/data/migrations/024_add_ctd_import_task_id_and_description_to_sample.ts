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

// `ctd_import_task_id` links a sample to the IMPORT_CTD task that imported its CTD file.
// ON DELETE SET NULL: tasks can be deleted by their owner, and foreign keys are enforced.
// `ctd_description` lists the custom (non-standard) columns of the imported CTD file.
export const migration: Migration = {
    id: "024_add_ctd_import_task_id_and_description_to_sample",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");

        if (!cols.includes("ctd_import_task_id")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN ctd_import_task_id INTEGER REFERENCES task(task_id) ON DELETE SET NULL;`);
        }
        if (!cols.includes("ctd_description")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN ctd_description TEXT;`);
        }
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        for (const col of ["ctd_description", "ctd_import_task_id"]) {
            if (cols.includes(col)) await runSQL(db, `ALTER TABLE sample DROP COLUMN ${col};`);
        }
    },
};
