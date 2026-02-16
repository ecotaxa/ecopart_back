# ecopart_back

[![Tests CI](https://github.com/ecotaxa/ecopart_back/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/ecotaxa/ecopart_back/actions/workflows/main.yml)
[![codecov](https://codecov.io/github/ecotaxa/ecopart_back/graph/badge.svg?token=C0I2UCLP07)](https://codecov.io/github/ecotaxa/ecopart_back)

**Backend of the EcoPart application**

This repository contains the backend codebase for the EcoPart application, built using TypeScript, NodeJS, Express, SQLite, and Jest for testing. The architecture follows a clean structure, and the API is designed based on REST principles.

### Installation

To install the necessary dependencies, run the following command:

```bash
npm install
```

### Running the Backend in Development Mode

To run the backend in development mode with automatic restarts on code changes, use the following command:

```bash
npm run dev:watch
```

### Running Tests and Generating Coverage Report

To execute tests and generate a coverage report, use the following command:

```bash
npm run test
```

### Publishing a New Version of the Application

To publish a new version, create and push a new tag for the application's code. Pushing a tag in the GitHub repository triggers a GitHub Action that builds the Docker image and publishes it on Docker Hub. The Docker image can be found [here](https://hub.docker.com/repository/docker/ecotaxa/ecopart_back/general).

```bash
git tag -a vXX.XX.XX -m "version message"
git push --follow-tags
```


### Production Procedure

To deploy a new version of the application to production, follow these steps:

1. **Prepare the Environment**:
   - Copy the `empty.env` file to your server and rename it to `.env`. Set your environment variables as needed.

2. **Run the Application**:
   - Copy the `docker-compose.yml` file to your server.
   - Run the following command to start the application using Docker Compose:

     ```bash
     docker compose up
     ```

### Link with EcoTaxa
You can configure GENERIC_ECOTAXA_ACCOUNT_EMAIL in the .env file. Applicative accounts are created with this email in every EcoTaxa instances. You should then loggin to ecopart user that uses the same email as GENERIC_ECOTAXA_ACCOUNT_EMAIL and loggin for every instances to the related applicative ecotaxa account. For now you should reconnect to theses accounts every 30 day. We are working on an EcoTaxa feature to ease this process trough a refresh token or longer token.

### Database

EcoPart uses **SQLite** as its database. The database file location is configured via the `DBSOURCE_FOLDER` and `DBSOURCE_NAME` environment variables in the `.env` file.

#### Database Migrations

The project includes a lightweight migration system to manage database schema changes over time. Migrations are stored as TypeScript files in `src/data/migrations/` and are **automatically applied on application startup** before any data sources are initialized.

**Every time the Docker container starts (or restarts), the application automatically detects and runs all pending migrations in alphabetical order.** This means deploying a new image that contains new migration files is all that is needed — no manual migration step is required. Already applied migrations are skipped, so the process is safe to run repeatedly.

Each migration file exports a `migration` object with:
- **`id`** – A unique identifier (e.g. `000_initial_schema`)
- **`up(db)`** – Applies the migration
- **`down(db)`** – Reverts the migration

Applied migrations are tracked in a `_migrations` table inside the SQLite database.

#### Migration Logs

All migration activity (successes, errors, and warnings) is logged in two places:

1. **Console output** — visible via `docker logs <container>` or `docker compose logs api`.
2. **Log file** — written to `<DATA_STORAGE_FOLDER>/migrations.log` (inside the Docker volume).

Each log entry includes an ISO timestamp, log level, and a descriptive message:

```
[2026-02-13T14:30:00.123Z] [MIGRATION] [INFO] ════════════════════════════════════════════════════════════
[2026-02-13T14:30:00.124Z] [MIGRATION] [INFO] Migration run started — 2 pending out of 3 total migration(s).
[2026-02-13T14:30:00.130Z] [MIGRATION] [INFO]   ↑ Applying migration: 001_add_status_column
[2026-02-13T14:30:00.145Z] [MIGRATION] [INFO]     ✓ 001_add_status_column applied successfully.
[2026-02-13T14:30:00.150Z] [MIGRATION] [INFO]   ↑ Applying migration: 002_create_audit_table
[2026-02-13T14:30:00.162Z] [MIGRATION] [INFO]     ✓ 002_create_audit_table applied successfully.
[2026-02-13T14:30:00.163Z] [MIGRATION] [INFO] Migration run complete — 2 migration(s) applied: 001_add_status_column, 002_create_audit_table
[2026-02-13T14:30:00.163Z] [MIGRATION] [INFO] ════════════════════════════════════════════════════════════
```

If a migration fails, the error is logged and the application stops to prevent the database from being left in an inconsistent state:

```
[2026-02-13T14:30:00.150Z] [MIGRATION] [ERROR]     ✗ Migration 002_create_audit_table failed. | SQLITE_ERROR: ...
```

To check the migration log from the server:

```bash
# Via Docker
docker compose exec api cat /src/data_storage/migrations.log

# Or directly on the mounted volume
cat ./data_storage/migrations.log
```

#### Migration CLI

Four npm scripts are available to manage migrations:

| Command                            | Description                                  |
| ---------------------------------- | -------------------------------------------- |
| `npm run migrate:create -- <name>` | Create a new timestamped migration file      |
| `npm run migrate:up`               | Run all pending migrations                   |
| `npm run migrate:down`             | Rollback the last applied migration          |
| `npm run migrate:status`           | Show which migrations are applied or pending |

#### Creating a New Migration

```bash
npm run migrate:create -- add_column_to_project
```

This generates a file like `20260213143000_add_column_to_project.ts` in `src/data/migrations/` with `up` and `down` stubs ready to fill in.

#### Example Migration

```typescript
import { Migration } from "./migration-manager";
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
    id: "20260213143000_add_column_to_project",

    async up(db: SQLiteDatabaseWrapper): Promise<void> {
        await runSQL(db, "ALTER TABLE project ADD COLUMN status TEXT DEFAULT 'active';");
    },

    async down(db: SQLiteDatabaseWrapper): Promise<void> {
        // SQLite has limited ALTER TABLE support — column removal
        // may require recreating the table.
    },
};
```

#### Important Notes

- Migrations run **in alphabetical order** by filename, which is why filenames are prefixed with a timestamp.
- The initial migration (`000_initial_schema.ts`) captures the full existing schema using `CREATE TABLE IF NOT EXISTS`, making it safe on both fresh and existing databases.
- Migrations are executed inside the application startup flow (in `src/main.ts`), so deploying a new version with new migration files is enough — no manual step is required.
- For production rollbacks, use `npm run migrate:down` from the server or connect via the CLI tool at `tools/migrate.ts`.

### Glossary

**Clean Architecture** is a software design principle that emphasizes separation of concerns and modularity, aiming to create a flexible and maintainable codebase. It divides the application into layers, such as *presentation*, *domain*, and *data*, ensuring that dependencies flow inward, maintaining a clear boundary between the layers. This approach allows developers to change the implementation details of one layer without affecting the others, promoting code reusability and testability.

**REST API** (Representational State Transfer API) is a set of guidelines and principles for designing web services that communicate over HTTP. It follows a stateless client-server architecture where each resource is uniquely identified by a URL, and standard HTTP methods (GET, POST, PUT, DELETE) are used to perform CRUD (Create, Read, Update, Delete) operations on these resources. REST APIs are designed to be scalable, simple, and easily integrated with various platforms, making them a popular choice for building web services.
