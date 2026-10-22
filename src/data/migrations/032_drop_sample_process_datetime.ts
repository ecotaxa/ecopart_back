import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// `instrument_settings_process_datetime` (legacy `proc_datetime`, a manual field of its sample edition
// form) was never filled: no EcoPart code wrote it and it was empty in the legacy database too. Dropped
// at Julie's request (22 Oct 2026), with its export column. `down` brings the column back, empty.
const COLUMN = "instrument_settings_process_datetime";

function sampleColumns(db: SQLiteDatabaseWrapper): Promise<string[]> {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(sample);`, [], (err, rows) => {
            if (err) reject(err);
            else resolve(((rows ?? []) as { name: string }[]).map(r => r.name));
        });
    });
}

export const migration: Migration = {
    id: "032_drop_sample_process_datetime",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        if (!(await sampleColumns(db)).includes(COLUMN)) return;
        await runSQL(db, `ALTER TABLE sample DROP COLUMN ${COLUMN};`);
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        if ((await sampleColumns(db)).includes(COLUMN)) return;
        await runSQL(db, `ALTER TABLE sample ADD COLUMN ${COLUMN} TEXT;`);
    },
};
