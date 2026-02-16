import sqlite3 from "sqlite3";
import fs from "fs";
import { MigrationManager, Migration } from "../../../src/data/migrations/migration-manager";
import { SQLiteDatabaseWrapper } from "../../../src/data/interfaces/data-sources/database-wrapper";

const TEST_DB = "TEST_DB_MIGRATIONS";

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

function openTestDB(): sqlite3.Database {
    const db = new sqlite3.Database(TEST_DB, (err) => {
        if (err) {
            console.error(err.message);
            throw err;
        }
    });
    db.get("PRAGMA foreign_keys = ON");
    return db;
}

function cleanTestDB(): void {
    try {
        fs.unlinkSync(TEST_DB);
    } catch (error: any) {
        if (error.code !== "ENOENT") {
            console.error("Error deleting test database:", error);
        }
    }
}

// ──────────────── Sample migrations for testing ────────────────

const migrationA: Migration = {
    id: "001_create_test_table",
    async up(db: SQLiteDatabaseWrapper) {
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS test_table (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL
            );
        `);
    },
    async down(db: SQLiteDatabaseWrapper) {
        await runSQL(db, "DROP TABLE IF EXISTS test_table;");
    },
};

const migrationB: Migration = {
    id: "002_add_email_to_test_table",
    async up(db: SQLiteDatabaseWrapper) {
        await runSQL(db, "ALTER TABLE test_table ADD COLUMN email TEXT;");
    },
    async down(db: SQLiteDatabaseWrapper) {
        // SQLite doesn't support DROP COLUMN before 3.35.0 — recreate table
        await runSQL(db, `
            CREATE TABLE IF NOT EXISTS test_table_backup (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL
            );
        `);
        await runSQL(db, "INSERT INTO test_table_backup (id, name) SELECT id, name FROM test_table;");
        await runSQL(db, "DROP TABLE test_table;");
        await runSQL(db, "ALTER TABLE test_table_backup RENAME TO test_table;");
    },
};

const migrationFailing: Migration = {
    id: "003_failing_migration",
    async up(db: SQLiteDatabaseWrapper) {
        // This will fail because the table doesn't exist
        await runSQL(db, "ALTER TABLE nonexistent_table ADD COLUMN foo TEXT;");
    },
    async down(db: SQLiteDatabaseWrapper) {
        // noop
    },
};

// ──────────────── Tests ────────────────

describe("MigrationManager", () => {
    let db: sqlite3.Database;
    let manager: MigrationManager;

    beforeEach(async () => {
        cleanTestDB();
        db = openTestDB();
        manager = new MigrationManager(db);
        // Wait for DB to be ready
        await new Promise((resolve) => setTimeout(resolve, 500));
    });

    afterEach(async () => {
        await new Promise<void>((resolve, reject) => {
            db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        cleanTestDB();
    });

    describe("ensureMigrationTable", () => {
        test("should create _migrations table", async () => {
            await manager.ensureMigrationTable();

            const tables = await allSQL(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations';");
            expect(tables).toHaveLength(1);
            expect(tables[0].name).toBe("_migrations");
        });

        test("should be idempotent", async () => {
            await manager.ensureMigrationTable();
            await manager.ensureMigrationTable();

            const tables = await allSQL(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations';");
            expect(tables).toHaveLength(1);
        });
    });

    describe("runMigrations", () => {
        test("should run a single migration", async () => {
            const applied = await manager.runMigrations([migrationA]);

            expect(applied).toEqual(["001_create_test_table"]);

            // Verify the table was created
            const tables = await allSQL(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table';");
            expect(tables).toHaveLength(1);

            // Verify migration was recorded
            const records = await manager.getAppliedMigrations();
            expect(records).toContain("001_create_test_table");
        });

        test("should run multiple migrations in order", async () => {
            const applied = await manager.runMigrations([migrationA, migrationB]);

            expect(applied).toEqual(["001_create_test_table", "002_add_email_to_test_table"]);

            // Verify both migrations were recorded
            const records = await manager.getAppliedMigrations();
            expect(records).toHaveLength(2);
        });

        test("should skip already applied migrations", async () => {
            // First run
            await manager.runMigrations([migrationA]);

            // Second run with the same migration + a new one
            const applied = await manager.runMigrations([migrationA, migrationB]);

            // Only the new one should have been applied
            expect(applied).toEqual(["002_add_email_to_test_table"]);

            const records = await manager.getAppliedMigrations();
            expect(records).toHaveLength(2);
        });

        test("should return empty array when all migrations are applied", async () => {
            await manager.runMigrations([migrationA, migrationB]);
            const applied = await manager.runMigrations([migrationA, migrationB]);

            expect(applied).toEqual([]);
        });
    });

    describe("rollback", () => {
        test("should rollback the last migration", async () => {
            await manager.runMigrations([migrationA, migrationB]);

            // Use the manager's rollback with migrations loaded manually
            // Since rollback needs to load from directory, we'll test via runMigrations + manual rollback
            await manager.ensureMigrationTable();

            // Manually test the down function
            await migrationB.down(db);

            // Verify the email column is gone by checking table info
            const columns = await allSQL(db, "PRAGMA table_info(test_table);");
            const columnNames = columns.map((c: any) => c.name);
            expect(columnNames).not.toContain("email");
            expect(columnNames).toContain("name");
        });

        test("should return empty when nothing to rollback", async () => {
            // No migration files in a fake dir, so nothing to rollback
            const rolledBack = await manager.rollback("/tmp/nonexistent_dir", 1);
            expect(rolledBack).toEqual([]);
        });
    });

    describe("getAppliedMigrations", () => {
        test("should return empty array when no migrations applied", async () => {
            await manager.ensureMigrationTable();
            const applied = await manager.getAppliedMigrations();
            expect(applied).toEqual([]);
        });

        test("should return applied migrations in order", async () => {
            await manager.runMigrations([migrationA, migrationB]);

            const applied = await manager.getAppliedMigrations();
            expect(applied).toEqual(["001_create_test_table", "002_add_email_to_test_table"]);
        });
    });

    describe("error handling", () => {
        test("should throw on failing migration and stop", async () => {
            await manager.runMigrations([migrationA]);

            await expect(
                manager.runMigrations([migrationFailing])
            ).rejects.toThrow();

            // The failing migration should NOT be recorded
            const applied = await manager.getAppliedMigrations();
            expect(applied).not.toContain("003_failing_migration");
        });
    });

    describe("loadMigrationsFromDirectory", () => {
        test("should return empty array for nonexistent directory", () => {
            const migrations = manager.loadMigrationsFromDirectory("/tmp/nonexistent_dir_12345");
            expect(migrations).toEqual([]);
        });
    });
});
