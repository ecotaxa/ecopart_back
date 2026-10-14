#!/usr/bin/env ts-node

/**
 * CLI tool for managing database migrations.
 *
 * Usage:
 *   npx ts-node tools/migrate.ts create <name>      Create a new migration file
 *   npx ts-node tools/migrate.ts up                  Run all pending migrations
 *   npx ts-node tools/migrate.ts down [count]        Rollback last N migrations (default: 1)
 *   npx ts-node tools/migrate.ts status              Show migration status
 *
 * Or via npm scripts:
 *   npm run migrate:create -- <name>
 *   npm run migrate:up
 *   npm run migrate:down
 *   npm run migrate:status
 */

import path from "path";
import fs from "fs";
import sqlite3 from "sqlite3";
import "dotenv/config";
import { MigrationManager } from "../src/data/migrations/migration-manager";
import { MigrationLogger } from "../src/data/migrations/migration-logger";

sqlite3.verbose();

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "src", "data", "migrations");

const config = {
    DBSOURCE_NAME: process.env.DBSOURCE_NAME || "",
    DBSOURCE_FOLDER: process.env.DBSOURCE_FOLDER || "",
    DATA_STORAGE_FOLDER: process.env.DATA_STORAGE_FOLDER || "",
};

// ──────────────── helpers ────────────────

// Migrations run in alphabetical order and are all numbered NNN_. A timestamp prefix would sort after
// every numbered one, so a later NNN_ migration would run before an older timestamped one.
function getNextMigrationNumber(): string {
    const numbers = fs.readdirSync(MIGRATIONS_DIR)
        .map((file) => /^(\d{3})_/.exec(file))
        .filter((match): match is RegExpExecArray => match !== null)
        .map((match) => parseInt(match[1], 10));
    const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 0;
    return next.toString().padStart(3, "0");
}

function openDatabase(): Promise<sqlite3.Database> {
    return new Promise((resolve, reject) => {
        const dbPath = path.resolve(config.DBSOURCE_FOLDER, config.DBSOURCE_NAME);
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error("Cannot open database:", err.message);
                reject(err);
            } else {
                console.log(`Connected to SQLite database at ${dbPath}`);
                db.get("PRAGMA foreign_keys = ON");
                resolve(db);
            }
        });
    });
}

function closeDatabase(db: sqlite3.Database): Promise<void> {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// ──────────────── commands ────────────────

async function createMigration(name: string): Promise<void> {
    if (!name) {
        console.error("Please provide a migration name. Example: npx ts-node tools/migrate.ts create add_column_to_user");
        process.exit(1);
    }

    // Sanitize name
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    const number = getNextMigrationNumber();
    const filename = `${number}_${safeName}.ts`;
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const migrationId = `${number}_${safeName}`;

    const template = `import { Migration } from "./migration-manager";
import { SQLiteDatabaseWrapper } from "../interfaces/data-sources/database-wrapper";

function runSQL(db: SQLiteDatabaseWrapper, sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve();
        });
    });
}

export const migration: Migration = {
    id: "${migrationId}",
    // Runs in a transaction. Uncomment when up or down rebuilds a table (copy, DROP, RENAME):
    // foreignKeysOff: true,

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        // TODO: Write your migration here
        // Example:
        // await runSQL(db, "ALTER TABLE user ADD COLUMN new_column TEXT;");
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        // TODO: Write the reverse of your migration here
        // Note: SQLite has limited ALTER TABLE support.
        // For column removal, you may need to recreate the table.
    },
};
`;

    fs.writeFileSync(filepath, template);
    console.log(`✓ Created migration: ${filepath}`);
}

async function runUp(): Promise<void> {
    const db = await openDatabase();
    try {
        const logFile = config.DATA_STORAGE_FOLDER ? path.resolve(config.DATA_STORAGE_FOLDER, 'migrations.log') : null;
        const logger = new MigrationLogger(logFile);
        const manager = new MigrationManager(db, logger);
        const applied = await manager.runAllMigrations(MIGRATIONS_DIR);
        if (applied.length === 0) {
            console.log("Database is already up to date.");
        } else {
            console.log(`\n✓ Applied ${applied.length} migration(s): ${applied.join(", ")}`);
        }
    } finally {
        await closeDatabase(db);
    }
}

async function runDown(count: number): Promise<void> {
    const db = await openDatabase();
    try {
        const logFile = config.DATA_STORAGE_FOLDER ? path.resolve(config.DATA_STORAGE_FOLDER, 'migrations.log') : null;
        const logger = new MigrationLogger(logFile);
        const manager = new MigrationManager(db, logger);
        const rolledBack = await manager.rollback(MIGRATIONS_DIR, count);
        if (rolledBack.length === 0) {
            console.log("Nothing to rollback.");
        } else {
            console.log(`\n✓ Rolled back ${rolledBack.length} migration(s): ${rolledBack.join(", ")}`);
        }
    } finally {
        await closeDatabase(db);
    }
}

async function showStatus(): Promise<void> {
    const db = await openDatabase();
    try {
        const manager = new MigrationManager(db);
        await manager.ensureMigrationTable();

        const allMigrations = manager.loadMigrationsFromDirectory(MIGRATIONS_DIR);
        const applied = await manager.getAppliedMigrations();

        console.log("\nMigration status:");
        console.log("─".repeat(60));

        if (allMigrations.length === 0) {
            console.log("  No migration files found.");
        } else {
            for (const m of allMigrations) {
                const status = applied.includes(m.id) ? "✓ applied" : "○ pending";
                console.log(`  ${status}  ${m.id}`);
            }
        }

        const pending = allMigrations.filter((m) => !applied.includes(m.id));
        console.log("─".repeat(60));
        console.log(`  Total: ${allMigrations.length} | Applied: ${applied.length} | Pending: ${pending.length}`);
    } finally {
        await closeDatabase(db);
    }
}

// ──────────────── main ────────────────

async function main(): Promise<void> {
    const [, , command, ...args] = process.argv;

    switch (command) {
        case "create":
            await createMigration(args[0]);
            break;
        case "up":
            await runUp();
            break;
        case "down":
            await runDown(parseInt(args[0], 10) || 1);
            break;
        case "status":
            await showStatus();
            break;
        default:
            console.log(`
Database Migration Tool
=======================

Usage:
  npx ts-node tools/migrate.ts create <name>      Create a new migration file
  npx ts-node tools/migrate.ts up                  Run all pending migrations
  npx ts-node tools/migrate.ts down [count]        Rollback last N migrations (default: 1)
  npx ts-node tools/migrate.ts status              Show migration status

Or via npm scripts:
  npm run migrate:create -- <name>
  npm run migrate:up
  npm run migrate:down
  npm run migrate:status
`);
            break;
    }
}

main().catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
});
