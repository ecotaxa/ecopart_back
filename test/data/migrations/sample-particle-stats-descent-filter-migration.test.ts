import sqlite3 from "sqlite3";
import fs from "fs";

import { SQLiteDatabaseWrapper } from "../../../src/data/interfaces/data-sources/database-wrapper";
import { migration } from "../../../src/data/migrations/037_sample_particle_stats_descent_filter";

const TEST_DB = "TEST_DB_SAMPLE_PARTICLE_STATS_DESCENT_FILTER_MIGRATION";

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
const STATS = "nb_particles, particle_min_area_px, particle_max_area_px";
const STATS_DESCENT = "nb_particles_descent_filter, particle_min_area_px_descent_filter, particle_max_area_px_descent_filter";

beforeEach(async () => {
    try { fs.unlinkSync(TEST_DB); } catch { /* absent — fine */ }
    db = new sqlite3.Database(TEST_DB);
    await runSQL(wrapper(), `CREATE TABLE sample (sample_id INTEGER PRIMARY KEY AUTOINCREMENT, sample_name TEXT NOT NULL,
        nb_particles INTEGER, particle_min_area_px INTEGER, particle_max_area_px INTEGER);`);
    // Statistics computed before, with the project setting of that time, and a sample never computed.
    await runSQL(wrapper(), `INSERT INTO sample (sample_id, sample_name, ${STATS}) VALUES (1, 'moose_001', 345, 1, 4000), (2, 'moose_002', NULL, NULL, NULL);`);
});

afterEach(async () => {
    await new Promise<void>((resolve) => db.close(() => resolve()));
    try { fs.unlinkSync(TEST_DB); } catch { /* already gone — fine */ }
});

const columns = async () => (await allSQL<{ name: string }>(wrapper(), `PRAGMA table_info(sample);`)).map(column => column.name);

describe("037_sample_particle_stats_descent_filter", () => {
    test("adds the statistics over the images the descent filter keeps, and resets the ones computed before", async () => {
        await migration.up(wrapper());

        expect(await columns()).toEqual(["sample_id", "sample_name", "nb_particles", "particle_min_area_px", "particle_max_area_px",
            "nb_particles_descent_filter", "particle_min_area_px_descent_filter", "particle_max_area_px_descent_filter"]);
        expect(await allSQL(wrapper(), `SELECT sample_id, ${STATS}, ${STATS_DESCENT} FROM sample ORDER BY sample_id;`)).toEqual([
            { sample_id: 1, nb_particles: null, particle_min_area_px: null, particle_max_area_px: null, nb_particles_descent_filter: null, particle_min_area_px_descent_filter: null, particle_max_area_px_descent_filter: null },
            { sample_id: 2, nb_particles: null, particle_min_area_px: null, particle_max_area_px: null, nb_particles_descent_filter: null, particle_min_area_px_descent_filter: null, particle_max_area_px_descent_filter: null },
        ]);
    });

    test("runs twice without error and keeps the statistics computed in between", async () => {
        await migration.up(wrapper());
        await runSQL(wrapper(), `UPDATE sample SET ${STATS.split(", ").map(c => `${c} = 7`).join(", ")}, ${STATS_DESCENT.split(", ").map(c => `${c} = 5`).join(", ")} WHERE sample_id = 1;`);

        await migration.up(wrapper());

        expect(await allSQL(wrapper(), `SELECT nb_particles, nb_particles_descent_filter FROM sample WHERE sample_id = 1;`)).toEqual([{ nb_particles: 7, nb_particles_descent_filter: 5 }]);
    });

    test("down removes the added columns only", async () => {
        await migration.up(wrapper());
        await migration.down(wrapper());

        expect(await columns()).toEqual(["sample_id", "sample_name", "nb_particles", "particle_min_area_px", "particle_max_area_px"]);
    });
});
