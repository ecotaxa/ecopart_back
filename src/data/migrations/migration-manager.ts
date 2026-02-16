import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";
import path from "path";
import fs from "fs";
import { MigrationLogger } from "./migration-logger";

/**
 * Represents a single database migration.
 */
export interface Migration {
    /** Unique migration identifier, e.g. "001_create_user_table" */
    id: string;
    /** Apply the migration (upgrade) */
    up(db: SQLiteDatabaseWrapper): Promise<void>;
    /** Revert the migration (downgrade) */
    down(db: SQLiteDatabaseWrapper): Promise<void>;
}

/**
 * Record stored in the _migrations tracking table.
 */
interface MigrationRecord {
    id: string;
    applied_at: string;
}

/**
 * Lightweight database migration manager for SQLite.
 *
 * Tracks applied migrations in a `_migrations` table and runs
 * pending migrations in order on application startup.
 *
 * Usage:
 * ```ts
 * const manager = new MigrationManager(db);
 * await manager.runAllMigrations();
 * ```
 */
export class MigrationManager {
    private db: SQLiteDatabaseWrapper;
    private logger: MigrationLogger;

    constructor(db: SQLiteDatabaseWrapper, logger?: MigrationLogger) {
        this.db = db;
        this.logger = logger || new MigrationLogger(null);
    }

    // ──────────────── helpers to promisify the sqlite3 callback API ────────────────

    private runSQL(sql: string, params: any[] = []): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    private allSQL<T = any>(sql: string, params: any[] = []): Promise<T[]> {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve((rows || []) as T[]);
            });
        });
    }

    // ──────────────── tracking table ────────────────

    /**
     * Ensure the `_migrations` tracking table exists.
     */
    async ensureMigrationTable(): Promise<void> {
        await this.runSQL(`
            CREATE TABLE IF NOT EXISTS '_migrations' (
                id TEXT PRIMARY KEY,
                applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);
    }

    /**
     * Return the list of migration IDs that have already been applied.
     */
    async getAppliedMigrations(): Promise<string[]> {
        const rows = await this.allSQL<MigrationRecord>(
            "SELECT id FROM '_migrations' ORDER BY id ASC"
        );
        return rows.map((r) => r.id);
    }

    /**
     * Record a migration as applied.
     */
    private async markAsApplied(id: string): Promise<void> {
        await this.runSQL("INSERT INTO '_migrations' (id) VALUES (?)", [id]);
    }

    /**
     * Remove a migration record (used during rollback).
     */
    private async markAsReverted(id: string): Promise<void> {
        await this.runSQL("DELETE FROM '_migrations' WHERE id = ?", [id]);
    }

    // ──────────────── loading migrations ────────────────

    /**
     * Dynamically load all migration files from the given directory.
     * Migration files must export a `migration` object implementing the `Migration` interface.
     * Files are sorted alphabetically by name to guarantee execution order.
     */
    loadMigrationsFromDirectory(migrationsDir: string): Migration[] {
        if (!fs.existsSync(migrationsDir)) {
            this.logger.warn(`Migrations directory not found: ${migrationsDir}`);
            return [];
        }

        const files = fs
            .readdirSync(migrationsDir)
            .filter((f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.includes("migration-manager"))
            .sort();

        const migrations: Migration[] = [];
        for (const file of files) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const mod = require(path.resolve(migrationsDir, file));
                if (mod.migration && mod.migration.id && mod.migration.up && mod.migration.down) {
                    migrations.push(mod.migration);
                }
            } catch (err) {
                this.logger.error(`Failed to load migration file ${file}`, err);
            }
        }

        return migrations;
    }

    // ──────────────── running migrations ────────────────

    /**
     * Run all pending migrations found in `src/data/migrations/` (or `dist/data/migrations/`).
     * This is the main entry-point called at application startup.
     */
    async runAllMigrations(migrationsDir?: string): Promise<string[]> {
        await this.ensureMigrationTable();

        const dir =
            migrationsDir ||
            path.resolve(__dirname); // defaults to the directory this file lives in

        const allMigrations = this.loadMigrationsFromDirectory(dir);
        const applied = await this.getAppliedMigrations();
        const pending = allMigrations.filter((m) => !applied.includes(m.id));

        this.logger.logRunStart(pending.length, allMigrations.length);

        if (pending.length === 0) {
            this.logger.logRunComplete([]);
            return [];
        }

        const justApplied: string[] = [];

        for (const migration of pending) {
            try {
                this.logger.logMigrationApplying(migration.id);
                await migration.up(this.db);
                await this.markAsApplied(migration.id);
                justApplied.push(migration.id);
                this.logger.logMigrationApplied(migration.id);
            } catch (err) {
                this.logger.logMigrationFailed(migration.id, err);
                throw err; // stop on first failure
            }
        }

        this.logger.logRunComplete(justApplied);
        return justApplied;
    }

    /**
     * Run a list of specific migrations by their objects.
     * Useful for testing or selective migration.
     */
    async runMigrations(migrations: Migration[]): Promise<string[]> {
        await this.ensureMigrationTable();
        const applied = await this.getAppliedMigrations();
        const pending = migrations.filter((m) => !applied.includes(m.id));
        const justApplied: string[] = [];

        for (const migration of pending) {
            this.logger.logMigrationApplying(migration.id);
            await migration.up(this.db);
            await this.markAsApplied(migration.id);
            justApplied.push(migration.id);
            this.logger.logMigrationApplied(migration.id);
        }

        return justApplied;
    }

    /**
     * Rollback the last N applied migrations (default: 1).
     */
    async rollback(migrationsDir?: string, count: number = 1): Promise<string[]> {
        await this.ensureMigrationTable();

        const dir =
            migrationsDir ||
            path.resolve(__dirname);

        const allMigrations = this.loadMigrationsFromDirectory(dir);
        const applied = await this.getAppliedMigrations();

        // Get the last `count` applied migrations in reverse order
        const toRollback = applied
            .slice(-count)
            .reverse()
            .map((id) => allMigrations.find((m) => m.id === id))
            .filter((m): m is Migration => m !== undefined);

        if (toRollback.length === 0) {
            this.logger.info("Nothing to rollback.");
            return [];
        }

        const rolledBack: string[] = [];
        for (const migration of toRollback) {
            try {
                this.logger.logRollbackApplying(migration.id);
                await migration.down(this.db);
                await this.markAsReverted(migration.id);
                rolledBack.push(migration.id);
                this.logger.logRollbackApplied(migration.id);
            } catch (err) {
                this.logger.logRollbackFailed(migration.id, err);
                throw err;
            }
        }

        return rolledBack;
    }
}
