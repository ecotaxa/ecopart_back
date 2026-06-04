import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Removes the `optional_structure_id` column from `sample`. The field was a leftover
// from old EcoPart and is not used anywhere in the new app; per user decision it is
// dropped end-to-end (entity / data source / parsers / whitelists / fixtures / TSV).

function tableColumns(db: SQLiteDatabaseWrapper, table: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${table});`, [], (err, rows) => {
            if (err) reject(err);
            else resolve((rows ?? []).map((r: any) => r.name as string));
        });
    });
}

export const migration: Migration = {
    id: "016_drop_optional_structure_id",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        if (cols.includes("optional_structure_id")) {
            await runSQL(db, `ALTER TABLE sample DROP COLUMN optional_structure_id;`);
        }
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "sample");
        if (!cols.includes("optional_structure_id")) {
            await runSQL(db, `ALTER TABLE sample ADD COLUMN optional_structure_id TEXT;`);
        }
    },
};
