import fs from "fs";
import os from "os";
import path from "path";
import sqlite3 from "sqlite3";
import { MigrationManager } from "../../../src/data/migrations/migration-manager";
import { SQLiteProjectDataSource } from "../../../src/data/data-sources/sqlite/sqlite-project-data-source";
import { SQLiteStatsDataSource } from "../../../src/data/data-sources/sqlite/sqlite-stats-data-source";
import { StatsRepositoryImpl } from "../../../src/domain/repositories/stats-repository";
import { data_source_projectRequestCreationModel_2 } from "../../entities/project";

function run(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => db.run(sql, params, (err) => err ? reject(err) : resolve()));
}

function monthsAgo(months: number): string {
    const date = new Date();
    date.setUTCDate(15);
    date.setUTCMonth(date.getUTCMonth() - months);
    return date.toISOString();
}

describe("Stats repository - projects by privacy (real SQLite)", () => {
    let workdir: string;
    let db: sqlite3.Database;
    let projects: SQLiteProjectDataSource;
    let repo: StatsRepositoryImpl;

    async function addProject(created: string, durations: [number, number, number]): Promise<void> {
        const [privacy_duration, visible_duration, public_duration] = durations;
        const id = await projects.create({ ...data_source_projectRequestCreationModel_2, privacy_duration, visible_duration, public_duration });
        await run(db, "UPDATE project SET project_creation_utc_date_time = ? WHERE project_id = ?", [created, id]);
    }

    beforeEach(async () => {
        workdir = fs.mkdtempSync(path.join(os.tmpdir(), "stats-privacy-"));
        db = new sqlite3.Database(path.join(workdir, "test.db"));
        await new MigrationManager(db).runAllMigrations(path.resolve(__dirname, "../../../src/data/migrations"));
        projects = new SQLiteProjectDataSource(db);
        repo = new StatsRepositoryImpl(new SQLiteStatsDataSource(db));
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => db.close(() => resolve()));
        fs.rmSync(workdir, { recursive: true, force: true });
    });

    test("lists the four levels in order with a count of 0 when there is no project", async () => {
        const stats = await repo.getGlobalStats({});

        expect(stats.totals.projects.by_privacy).toStrictEqual([
            { label: "private", count: 0 },
            { label: "visible", count: 0 },
            { label: "public", count: 0 },
            { label: "open", count: 0 },
        ]);
    });

    test("counts each project at the level its creation date and durations give today", async () => {
        await addProject(monthsAgo(1), [12, 12, 12]);
        await addProject(monthsAgo(13), [12, 12, 12]);
        await addProject(monthsAgo(30), [12, 12, 12]);
        await addProject(monthsAgo(50), [12, 12, 12]);
        await addProject(monthsAgo(40), [12, 12, 12]);
        await addProject("not a date", [0, 0, 0]);

        const stats = await repo.getGlobalStats({});

        expect(stats.totals.projects.total).toBe(6);
        expect(stats.totals.projects.by_privacy).toStrictEqual([
            { label: "private", count: 2 },
            { label: "visible", count: 1 },
            { label: "public", count: 1 },
            { label: "open", count: 2 },
        ]);
    });
});
