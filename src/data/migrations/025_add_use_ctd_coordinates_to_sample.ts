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

// `use_ctd_coordinates` selects which position is the sample's reference: false (default) =
// the particle-file coordinates (`latitude`/`longitude`), true = the CTD-file ones
// (`ctd_latitude`/`ctd_longitude`).
export const migration: Migration = {
    id: "025_add_use_ctd_coordinates_to_sample",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");

        if (!cols.includes("use_ctd_coordinates")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN use_ctd_coordinates BOOLEAN NOT NULL DEFAULT 0;`);
        }
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        if (cols.includes("use_ctd_coordinates")) {
            await runSQL(db, `ALTER TABLE sample DROP COLUMN use_ctd_coordinates;`);
        }
    },
};
