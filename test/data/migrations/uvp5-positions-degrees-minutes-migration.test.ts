import sqlite3 from "sqlite3";
import fs from "fs";

import { SQLiteDatabaseWrapper } from "../../../src/data/interfaces/data-sources/database-wrapper";
import { migration } from "../../../src/data/migrations/045_uvp5_positions_from_degrees_minutes";
import { parseUvpCoordinate } from "../../../src/domain/utils/uvp-coordinates";

const TEST_DB = "TEST_DB_UVP5_POSITIONS_MIGRATION";

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

let db: sqlite3.Database;
const wrapper = () => db as unknown as SQLiteDatabaseWrapper;

// [sample_name, project_id, latitude, longitude] as the import stored them, straight from the header
const STORED: [string, number, number | null, number | null][] = [
    ["uvp5_villefranche", 1, 43.4111, 7.1901],
    ["uvp5_south_west", 1, -21.5997, -72.0001],
    ["uvp5_just_south", 1, -0.3995, -22.5993],
    ["uvp5_whole_degrees", 1, -18, -71],
    ["uvp5_latitude_not_minutes", 2, 32.9, -149.3199],
    ["uvp5_longitude_not_minutes", 2, 31.4, -64.6],
    ["uvp5_without_position", 2, null, null],
    ["uvp6_untouched", 3, 43.67861, 7.94152],
    ["no_instrument_untouched", 4, 43.4111, 7.1901],
];

beforeEach(async () => {
    try { fs.unlinkSync(TEST_DB); } catch { /* absent — fine */ }
    db = new sqlite3.Database(TEST_DB);
    await runSQL(wrapper(), `CREATE TABLE instrument_model (instrument_model_id INTEGER PRIMARY KEY, instrument_model_name TEXT);`);
    await runSQL(wrapper(), `CREATE TABLE project (project_id INTEGER PRIMARY KEY, instrument_model INTEGER);`);
    await runSQL(wrapper(), `CREATE TABLE sample (sample_id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER, sample_name TEXT, latitude REAL, longitude REAL, ctd_latitude REAL, ctd_longitude REAL);`);
    await runSQL(wrapper(), `INSERT INTO instrument_model VALUES (1, 'UVP5HD'), (2, 'UVP5Z'), (3, 'UVP6LP');`);
    await runSQL(wrapper(), `INSERT INTO project VALUES (1, 1), (2, 2), (3, 3), (4, NULL);`);
    for (const [sample_name, project_id, latitude, longitude] of STORED) {
        await runSQL(wrapper(), `INSERT INTO sample (project_id, sample_name, latitude, longitude, ctd_latitude, ctd_longitude) VALUES (?, ?, ?, ?, 43.4111, 7.1901);`, [project_id, sample_name, latitude, longitude]);
    }
});

afterEach(async () => {
    await new Promise<void>((resolve) => db.close(() => resolve()));
    try { fs.unlinkSync(TEST_DB); } catch { /* already gone — fine */ }
});

async function positions(): Promise<Record<string, (number | null)[]>> {
    const rows = await allSQL(wrapper(), `SELECT sample_name, latitude, longitude, ctd_latitude, ctd_longitude FROM sample;`);
    return Object.fromEntries(rows.map(row => [row.sample_name, [row.latitude, row.longitude, row.ctd_latitude, row.ctd_longitude]]));
}

describe("045_uvp5_positions_from_degrees_minutes", () => {
    test("UVP5 positions are read as degrees.minutes, the others are left as they are : ok", async () => {
        await migration.up(wrapper());

        expect(await positions()).toEqual({
            uvp5_villefranche: [43.68517, 7.31683, 43.4111, 7.1901],
            uvp5_south_west: [-21.9995, -72.00017, 43.4111, 7.1901],
            uvp5_just_south: [-0.66583, -22.99883, 43.4111, 7.1901],
            uvp5_whole_degrees: [-18, -71, 43.4111, 7.1901],
            // 0.9 and 0.6 cannot be minutes: the whole sample is left untouched, to be deleted
            uvp5_latitude_not_minutes: [32.9, -149.3199, 43.4111, 7.1901],
            uvp5_longitude_not_minutes: [31.4, -64.6, 43.4111, 7.1901],
            uvp5_without_position: [null, null, 43.4111, 7.1901],
            uvp6_untouched: [43.67861, 7.94152, 43.4111, 7.1901],
            no_instrument_untouched: [43.4111, 7.1901, 43.4111, 7.1901],
        });
    });

    test("the stored positions get the values the import now computes : ok", async () => {
        await migration.up(wrapper());

        const after = await positions();
        for (const [sample_name, project_id, latitude, longitude] of STORED) {
            if (project_id > 2 || latitude === null || longitude === null || sample_name.endsWith("_not_minutes")) continue;
            expect([sample_name, after[sample_name][0], after[sample_name][1]]).toEqual([
                sample_name,
                parseUvpCoordinate(String(latitude), "degrees.minutes"),
                parseUvpCoordinate(String(longitude), "degrees.minutes"),
            ]);
        }
    });

    test("down brings the converted positions back : ok", async () => {
        await migration.up(wrapper());
        await migration.down(wrapper());

        const after = await positions();
        for (const [sample_name, , latitude, longitude] of STORED) {
            if (sample_name.endsWith("_not_minutes")) continue;
            expect([sample_name, after[sample_name][0], after[sample_name][1]]).toEqual([sample_name, latitude, longitude]);
        }
    });
});
