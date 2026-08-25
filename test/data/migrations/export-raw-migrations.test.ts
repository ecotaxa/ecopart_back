import sqlite3 from "sqlite3";
import fs from "fs";

import { SQLiteDatabaseWrapper } from "../../../src/data/interfaces/data-sources/database-wrapper";
import { migration as swapShutterExposure } from "../../../src/data/migrations/022_swap_sample_acq_shutter_speed_exposure";
import { migration as backfillPressureGain } from "../../../src/data/migrations/023_backfill_sample_acq_pressure_gain";

const TEST_DB = "TEST_DB_EXPORT_RAW_MIGRATIONS";

function runSQL(db: SQLiteDatabaseWrapper, sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err: Error | null) {
            if (err) reject(err);
            else resolve();
        });
    });
}

function allSQL<T = any>(db: SQLiteDatabaseWrapper, sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err: Error | null, rows: any[]) => {
            if (err) reject(err);
            else resolve((rows || []) as T[]);
        });
    });
}

// Minimal schema: only the columns and relations the two migrations touch.
async function createSchema(db: SQLiteDatabaseWrapper): Promise<void> {
    await runSQL(db, `CREATE TABLE _migrations (id TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
    await runSQL(db, `CREATE TABLE instrument_model (instrument_model_id INTEGER PRIMARY KEY AUTOINCREMENT, instrument_model_name TEXT);`);
    await runSQL(db, `CREATE TABLE project (project_id INTEGER PRIMARY KEY AUTOINCREMENT, instrument_model INTEGER);`);
    await runSQL(db, `CREATE TABLE sample (
        sample_id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        instrument_settings_acq_shutter_speed REAL,
        instrument_settings_acq_exposure REAL,
        instrument_settings_acq_pressure_gain REAL
    );`);
    // Same ids as production, so LIKE 'UVP5%' / 'UVP6%' is exercised on real model names.
    await runSQL(db, `INSERT INTO instrument_model (instrument_model_id, instrument_model_name) VALUES
        (1, 'UVP5HD'), (2, 'UVP5SD'), (3, 'UVP5Z'), (4, 'UVP6LP'), (5, 'UVP6HF');`);
}

let db: sqlite3.Database;

beforeEach(async () => {
    try { fs.unlinkSync(TEST_DB); } catch { /* absent — fine */ }
    db = new sqlite3.Database(TEST_DB);
    await createSchema(db as unknown as SQLiteDatabaseWrapper);
});

afterEach(async () => {
    await new Promise<void>((resolve) => db.close(() => resolve()));
    try { fs.unlinkSync(TEST_DB); } catch { /* already gone — fine */ }
});

describe("022_swap_sample_acq_shutter_speed_exposure", () => {
    const wrapper = () => db as unknown as SQLiteDatabaseWrapper;

    async function insertSample(shutter_speed: number | null, exposure: number | null): Promise<void> {
        await runSQL(wrapper(),
            `INSERT INTO sample (project_id, instrument_settings_acq_shutter_speed, instrument_settings_acq_exposure) VALUES (1, ?, ?);`,
            [shutter_speed, exposure]);
    }

    function readSample(): Promise<{ ss: number | null, ex: number | null }> {
        return allSQL(wrapper(), `SELECT instrument_settings_acq_shutter_speed ss, instrument_settings_acq_exposure ex FROM sample;`)
            .then(rows => rows[0]);
    }

    test("swaps the two values on a database that never ran the legacy 019 id", async () => {
        // Crossed row as previous releases stored it: the UVP5SD code landed in exposure.
        await insertSample(160, 12);

        await swapShutterExposure.up(wrapper());

        expect(await readSample()).toEqual({ ss: 12, ex: 160 });
    });

    test("NULLs survive the swap without becoming garbage", async () => {
        await insertSample(160, null);

        await swapShutterExposure.up(wrapper());

        expect(await readSample()).toEqual({ ss: null, ex: 160 });
    });

    test("does nothing when the legacy 019 id already performed the swap", async () => {
        await insertSample(12, 160); // already correct
        await runSQL(wrapper(), `INSERT INTO _migrations (id) VALUES ('019_swap_sample_acq_shutter_speed_exposure');`);

        await swapShutterExposure.up(wrapper());

        expect(await readSample()).toEqual({ ss: 12, ex: 160 });
    });

    test("down swaps back, and is skipped too on legacy-019 databases", async () => {
        await insertSample(160, 12);
        await swapShutterExposure.up(wrapper());
        await swapShutterExposure.down(wrapper());
        expect(await readSample()).toEqual({ ss: 160, ex: 12 });

        await runSQL(wrapper(), `INSERT INTO _migrations (id) VALUES ('019_swap_sample_acq_shutter_speed_exposure');`);
        await swapShutterExposure.down(wrapper());
        expect(await readSample()).toEqual({ ss: 160, ex: 12 });
    });
});

describe("023_backfill_sample_acq_pressure_gain", () => {
    const wrapper = () => db as unknown as SQLiteDatabaseWrapper;

    async function seedProject(project_id: number, instrument_model: number | null): Promise<void> {
        await runSQL(wrapper(), `INSERT INTO project (project_id, instrument_model) VALUES (?, ?);`, [project_id, instrument_model]);
    }

    async function seedSample(sample_id: number, project_id: number, gain: number | null): Promise<void> {
        await runSQL(wrapper(), `INSERT INTO sample (sample_id, project_id, instrument_settings_acq_pressure_gain) VALUES (?, ?, ?);`,
            [sample_id, project_id, gain]);
    }

    function readGains(): Promise<Array<{ sample_id: number, gain: number | null }>> {
        return allSQL(wrapper(), `SELECT sample_id, instrument_settings_acq_pressure_gain gain FROM sample ORDER BY sample_id;`);
    }

    test("fills 0.1 for every UVP5 sub-model and 1 for every UVP6 sub-model", async () => {
        await seedProject(1, 1); // UVP5HD
        await seedProject(2, 3); // UVP5Z
        await seedProject(3, 4); // UVP6LP
        await seedProject(4, 5); // UVP6HF
        await seedSample(1, 1, null);
        await seedSample(2, 2, null);
        await seedSample(3, 3, null);
        await seedSample(4, 4, null);

        await backfillPressureGain.up(wrapper());

        expect(await readGains()).toEqual([
            { sample_id: 1, gain: 0.1 },
            { sample_id: 2, gain: 0.1 },
            { sample_id: 3, gain: 1 },
            { sample_id: 4, gain: 1 },
        ]);
    });

    test("leaves an already filled gain untouched, even a hand-corrected one", async () => {
        await seedProject(1, 1);
        await seedSample(1, 1, 10);   // someone entered the reciprocal convention on purpose
        await seedSample(2, 1, null);

        await backfillPressureGain.up(wrapper());

        expect(await readGains()).toEqual([
            { sample_id: 1, gain: 10 },
            { sample_id: 2, gain: 0.1 },
        ]);
    });

    test("skips samples whose project has no resolvable instrument model", async () => {
        await seedProject(1, null);
        await seedProject(2, 99);     // dangling reference
        await seedSample(1, 1, null);
        await seedSample(2, 2, null);
        await seedSample(3, 404, null); // unknown project

        await backfillPressureGain.up(wrapper());

        expect(await readGains()).toEqual([
            { sample_id: 1, gain: null },
            { sample_id: 2, gain: null },
            { sample_id: 3, gain: null },
        ]);
    });

    test("is idempotent and its down is a deliberate no-op", async () => {
        await seedProject(1, 4); // UVP6LP
        await seedSample(1, 1, null);

        await backfillPressureGain.up(wrapper());
        await backfillPressureGain.up(wrapper());
        expect(await readGains()).toEqual([{ sample_id: 1, gain: 1 }]);

        await backfillPressureGain.down(wrapper());
        expect(await readGains()).toEqual([{ sample_id: 1, gain: 1 }]);
    });
});
