import { Migration, runSQL } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

// A sample whose particle file holds no readable pressure (e.g. a UVP6 drifting time series where
// every particules.csv row is NaN) has no max_pressure: it is stored as NULL, never as an invented
// value. SQLite cannot drop a NOT NULL constraint in place, so the table is rebuilt from its live
// definition (which carries every ALTER since 000) with only the max_pressure column changed.

function allSQL<T>(db: SQLiteDatabaseWrapper, sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve((rows ?? []) as T[]);
        });
    });
}

async function maxPressureIsNotNull(db: SQLiteDatabaseWrapper): Promise<boolean> {
    const cols = await allSQL<{ name: string, notnull: number }>(db, `PRAGMA table_info(sample);`);
    return cols.find(c => c.name === "max_pressure")?.notnull === 1;
}

async function rebuildSampleTable(db: SQLiteDatabaseWrapper, max_pressure_definition: string): Promise<void> {
    const [table] = await allSQL<{ sql: string }>(db, `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'sample';`);
    const create_sample_new = table.sql
        .replace(/\bmax_pressure\s+INTEGER(\s+NOT\s+NULL)?/i, max_pressure_definition)
        .replace(/^CREATE TABLE\s+("sample"|'sample'|`sample`|sample)\s*\(/i, "CREATE TABLE sample_new (");
    if (!create_sample_new.startsWith("CREATE TABLE sample_new (") || !create_sample_new.includes(max_pressure_definition)) {
        throw new Error("Unexpected definition of the sample table, max_pressure not rebuilt");
    }
    // The AUTOINCREMENT counter goes with the dropped table: restore it so no sample_id is reused.
    const [sequence] = await allSQL<{ seq: number }>(db, `SELECT seq FROM sqlite_sequence WHERE name = 'sample';`);
    const [{ foreign_keys }] = await allSQL<{ foreign_keys: number }>(db, `PRAGMA foreign_keys;`);

    await runSQL(db, `PRAGMA foreign_keys = OFF;`);
    try {
        await runSQL(db, `BEGIN;`);
        try {
            await runSQL(db, create_sample_new);
            await runSQL(db, `INSERT INTO sample_new SELECT * FROM sample;`);
            await runSQL(db, `DROP TABLE sample;`);
            await runSQL(db, `ALTER TABLE sample_new RENAME TO sample;`);
            if (sequence) {
                const [current] = await allSQL<{ seq: number }>(db, `SELECT seq FROM sqlite_sequence WHERE name = 'sample';`);
                await runSQL(db, `DELETE FROM sqlite_sequence WHERE name = 'sample';`);
                await runSQL(db, `INSERT INTO sqlite_sequence (name, seq) VALUES ('sample', ?);`, [Math.max(sequence.seq, current?.seq ?? 0)]);
            }
            await runSQL(db, `COMMIT;`);
        } catch (error) {
            await runSQL(db, `ROLLBACK;`).catch(() => undefined);
            throw error;
        }
    } finally {
        await runSQL(db, `PRAGMA foreign_keys = ${foreign_keys ? "ON" : "OFF"};`);
    }
}

export const migration: Migration = {
    id: "027_make_max_pressure_nullable",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        if (!(await maxPressureIsNotNull(db))) return;
        await rebuildSampleTable(db, "max_pressure INTEGER");
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        if (await maxPressureIsNotNull(db)) return;
        const [{ nb }] = await allSQL<{ nb: number }>(db, `SELECT COUNT(*) AS nb FROM sample WHERE max_pressure IS NULL;`);
        if (nb > 0) {
            throw new Error(`Cannot make max_pressure NOT NULL again: ${nb} sample(s) have no max_pressure`);
        }
        await rebuildSampleTable(db, "max_pressure INTEGER NOT NULL");
    },
};
