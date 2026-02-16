import fs from "fs";
import path from "path";

export type MigrationLogLevel = "INFO" | "ERROR" | "WARN";

export interface MigrationLogEntry {
    timestamp: string;
    level: MigrationLogLevel;
    message: string;
}

/**
 * Logger for database migrations.
 *
 * Logs migration events both to the console and to a log file.
 * The log file is stored in the data storage folder so it can be easily
 * checked from the Docker volume.
 *
 * Log file location: `<DATA_STORAGE_FOLDER>/migrations.log`
 */
export class MigrationLogger {
    private logFilePath: string | null;

    /**
     * @param logFilePath Absolute path to the log file. Pass `null` to disable file logging (e.g. in tests).
     */
    constructor(logFilePath: string | null) {
        this.logFilePath = logFilePath;

        // Ensure the log directory exists
        if (this.logFilePath) {
            const dir = path.dirname(this.logFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }

    private formatTimestamp(): string {
        return new Date().toISOString();
    }

    private formatMessage(level: MigrationLogLevel, message: string): string {
        return `[${this.formatTimestamp()}] [MIGRATION] [${level}] ${message}`;
    }

    private writeToFile(line: string): void {
        if (this.logFilePath) {
            try {
                fs.appendFileSync(this.logFilePath, line + "\n");
            } catch {
                // If we can't write to the log file, at least the console output is there
            }
        }
    }

    info(message: string): void {
        const line = this.formatMessage("INFO", message);
        console.log(line);
        this.writeToFile(line);
    }

    warn(message: string): void {
        const line = this.formatMessage("WARN", message);
        console.warn(line);
        this.writeToFile(line);
    }

    error(message: string, err?: unknown): void {
        const line = this.formatMessage("ERROR", message);
        console.error(line);
        if (err) console.error(err);
        const errorDetail = err instanceof Error ? ` | ${err.message}` : "";
        this.writeToFile(line + errorDetail);
    }

    /** Log a summary header for a migration run */
    logRunStart(pendingCount: number, totalCount: number): void {
        this.info("════════════════════════════════════════════════════════════");
        this.info(`Migration run started — ${pendingCount} pending out of ${totalCount} total migration(s).`);
    }

    /** Log successful completion of a full migration run */
    logRunComplete(appliedIds: string[]): void {
        if (appliedIds.length === 0) {
            this.info("Database is up to date — no pending migrations.");
        } else {
            this.info(`Migration run complete — ${appliedIds.length} migration(s) applied: ${appliedIds.join(", ")}`);
        }
        this.info("════════════════════════════════════════════════════════════");
    }

    /** Log that a single migration is being applied */
    logMigrationApplying(id: string): void {
        this.info(`  ↑ Applying migration: ${id}`);
    }

    /** Log that a single migration was applied successfully */
    logMigrationApplied(id: string): void {
        this.info(`    ✓ ${id} applied successfully.`);
    }

    /** Log that a single migration failed */
    logMigrationFailed(id: string, err: unknown): void {
        this.error(`    ✗ Migration ${id} failed.`, err);
    }

    /** Log that a rollback is being applied */
    logRollbackApplying(id: string): void {
        this.info(`  ↓ Rolling back migration: ${id}`);
    }

    /** Log that a rollback was applied successfully */
    logRollbackApplied(id: string): void {
        this.info(`    ✓ ${id} rolled back successfully.`);
    }

    /** Log that a rollback failed */
    logRollbackFailed(id: string, err: unknown): void {
        this.error(`    ✗ Rollback of ${id} failed.`, err);
    }
}
