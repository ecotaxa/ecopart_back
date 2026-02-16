import fs from "fs";
import { MigrationLogger } from "../../../src/data/migrations/migration-logger";

const TEST_LOG_FILE = "TEST_MIGRATION_LOG.log";

function cleanLogFile(): void {
    try {
        fs.unlinkSync(TEST_LOG_FILE);
    } catch (error: any) {
        if (error.code !== "ENOENT") {
            console.error("Error deleting test log file:", error);
        }
    }
}

describe("MigrationLogger", () => {
    afterEach(() => {
        cleanLogFile();
    });

    describe("file logging", () => {
        test("should create a log file and write info entries", () => {
            const logger = new MigrationLogger(TEST_LOG_FILE);
            logger.info("Test info message");

            const content = fs.readFileSync(TEST_LOG_FILE, "utf-8");
            expect(content).toContain("[MIGRATION]");
            expect(content).toContain("[INFO]");
            expect(content).toContain("Test info message");
        });

        test("should write error entries to the log file", () => {
            const logger = new MigrationLogger(TEST_LOG_FILE);
            logger.error("Test error message", new Error("something broke"));

            const content = fs.readFileSync(TEST_LOG_FILE, "utf-8");
            expect(content).toContain("[ERROR]");
            expect(content).toContain("Test error message");
            expect(content).toContain("something broke");
        });

        test("should write warn entries to the log file", () => {
            const logger = new MigrationLogger(TEST_LOG_FILE);
            logger.warn("Test warning");

            const content = fs.readFileSync(TEST_LOG_FILE, "utf-8");
            expect(content).toContain("[WARN]");
            expect(content).toContain("Test warning");
        });

        test("should append multiple entries to the same log file", () => {
            const logger = new MigrationLogger(TEST_LOG_FILE);
            logger.info("First message");
            logger.info("Second message");
            logger.error("Third message");

            const content = fs.readFileSync(TEST_LOG_FILE, "utf-8");
            const lines = content.trim().split("\n");
            expect(lines.length).toBe(3);
            expect(lines[0]).toContain("First message");
            expect(lines[1]).toContain("Second message");
            expect(lines[2]).toContain("Third message");
        });

        test("should include ISO timestamp in log entries", () => {
            const logger = new MigrationLogger(TEST_LOG_FILE);
            logger.info("Timestamp test");

            const content = fs.readFileSync(TEST_LOG_FILE, "utf-8");
            // ISO timestamp format: 2026-02-13T...
            expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });
    });

    describe("console logging (no file)", () => {
        test("should not throw when log file path is null", () => {
            const logger = new MigrationLogger(null);
            expect(() => logger.info("No file")).not.toThrow();
            expect(() => logger.error("No file error")).not.toThrow();
            expect(() => logger.warn("No file warn")).not.toThrow();
        });

        test("should not create a log file when path is null", () => {
            const logger = new MigrationLogger(null);
            logger.info("Should not create a file");

            expect(fs.existsSync(TEST_LOG_FILE)).toBe(false);
        });
    });

    describe("structured log methods", () => {
        test("logRunStart should log migration run header", () => {
            const logger = new MigrationLogger(TEST_LOG_FILE);
            logger.logRunStart(3, 5);

            const content = fs.readFileSync(TEST_LOG_FILE, "utf-8");
            expect(content).toContain("═══");
            expect(content).toContain("3 pending");
            expect(content).toContain("5 total");
        });

        test("logRunComplete should log applied migrations", () => {
            const logger = new MigrationLogger(TEST_LOG_FILE);
            logger.logRunComplete(["001_test", "002_test"]);

            const content = fs.readFileSync(TEST_LOG_FILE, "utf-8");
            expect(content).toContain("2 migration(s) applied");
            expect(content).toContain("001_test, 002_test");
        });

        test("logRunComplete should log up-to-date message when no migrations applied", () => {
            const logger = new MigrationLogger(TEST_LOG_FILE);
            logger.logRunComplete([]);

            const content = fs.readFileSync(TEST_LOG_FILE, "utf-8");
            expect(content).toContain("up to date");
        });

        test("logMigrationApplying should log the migration id", () => {
            const logger = new MigrationLogger(TEST_LOG_FILE);
            logger.logMigrationApplying("001_test");

            const content = fs.readFileSync(TEST_LOG_FILE, "utf-8");
            expect(content).toContain("↑ Applying migration: 001_test");
        });

        test("logMigrationApplied should log success", () => {
            const logger = new MigrationLogger(TEST_LOG_FILE);
            logger.logMigrationApplied("001_test");

            const content = fs.readFileSync(TEST_LOG_FILE, "utf-8");
            expect(content).toContain("✓ 001_test applied successfully");
        });

        test("logMigrationFailed should log failure with error", () => {
            const logger = new MigrationLogger(TEST_LOG_FILE);
            logger.logMigrationFailed("001_test", new Error("SQL syntax error"));

            const content = fs.readFileSync(TEST_LOG_FILE, "utf-8");
            expect(content).toContain("✗ Migration 001_test failed");
            expect(content).toContain("SQL syntax error");
        });

        test("logRollbackApplying should log the rollback", () => {
            const logger = new MigrationLogger(TEST_LOG_FILE);
            logger.logRollbackApplying("001_test");

            const content = fs.readFileSync(TEST_LOG_FILE, "utf-8");
            expect(content).toContain("↓ Rolling back migration: 001_test");
        });

        test("logRollbackApplied should log success", () => {
            const logger = new MigrationLogger(TEST_LOG_FILE);
            logger.logRollbackApplied("001_test");

            const content = fs.readFileSync(TEST_LOG_FILE, "utf-8");
            expect(content).toContain("✓ 001_test rolled back successfully");
        });

        test("logRollbackFailed should log failure", () => {
            const logger = new MigrationLogger(TEST_LOG_FILE);
            logger.logRollbackFailed("001_test", new Error("FK violation"));

            const content = fs.readFileSync(TEST_LOG_FILE, "utf-8");
            expect(content).toContain("✗ Rollback of 001_test failed");
            expect(content).toContain("FK violation");
        });
    });
});
