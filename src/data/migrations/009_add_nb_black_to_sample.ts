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
    id: "009_add_nb_black_to_sample",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        if (!cols.includes("nb_black")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN nb_black INTEGER NOT NULL DEFAULT 0;`);
        }
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        if (cols.includes("nb_black")) await runSQL(db, `ALTER TABLE sample DROP COLUMN nb_black;`);
    },
};
