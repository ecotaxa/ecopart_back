import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// Reads PRAGMA table_info to introspect the current column set on a table.
function tableColumns(db: SQLiteDatabaseWrapper, table: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${table});`, [], (err, rows) => {
            if (err) reject(err);
            else resolve((rows ?? []).map((r: any) => r.name as string));
        });
    });
}

export const migration: Migration = {
    id: "007_project_drop_information_rename_cruise_ship",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "project");

        if (cols.includes("project_information")) {
            await runSQL(db, `ALTER TABLE project DROP COLUMN project_information;`);
        }
        if (cols.includes("cruise") && !cols.includes("cruise_wmo")) {
            await runSQL(db, `ALTER TABLE project RENAME COLUMN cruise TO cruise_wmo;`);
        }
        if (cols.includes("ship") && !cols.includes("ship_floatref")) {
            await runSQL(db, `ALTER TABLE project RENAME COLUMN ship TO ship_floatref;`);
        }
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        const cols = await tableColumns(db, "project");

        if (cols.includes("ship_floatref") && !cols.includes("ship")) {
            await runSQL(db, `ALTER TABLE project RENAME COLUMN ship_floatref TO ship;`);
        }
        if (cols.includes("cruise_wmo") && !cols.includes("cruise")) {
            await runSQL(db, `ALTER TABLE project RENAME COLUMN cruise_wmo TO cruise;`);
        }
        if (!cols.includes("project_information")) {
            await runSQL(db, `ALTER TABLE project ADD COLUMN project_information TEXT;`);
        }
    },
};
