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

Once the image is published, the same workflow (`.github/workflows/public.yml`) automatically
**redeploys the test server** (see "Automatic deployment to the test server" below).

### Automatic deployment to the test server

Each `v*.*.*` tag push runs a `deploy-test` job that, once the new `:latest` image is on Docker
Hub, restarts the backend on the test server. Because the server sits behind a firewall, the job
runs on a **self-hosted GitHub Actions runner installed on the test server itself** — no inbound
SSH from GitHub is required.

The test server runs **both the frontend and the backend** from a single, hand-maintained
`docker-compose.yml` (see "Production Procedure" below). The deploy job restarts **only the
backend (`api`) service** — the frontend (`web`) is never touched, and the compose file itself is
never modified by CI.

One-time setup on the test server (done by whoever administers the machine):

1. **Install the runner at the _organization_ level** (not the repo level): GitHub
   *organization* → *Settings → Actions → Runners → New runner*. A single org-level runner is
   shared by both the backend and the frontend (`ecopart_front`) repos, so each repo's
   `deploy-test` job can use it. Give it the label `ecopart-test`, then install it as a service
   so it survives reboots:

   ```bash
   ./svc.sh install && ./svc.sh start
   ```

   > A repository-level runner only serves the repo it is registered to, so it could not be
   > shared with the frontend. Register it once on the organization instead.

2. **Docker access**: the runner's OS user must be in the `docker` group, and the server must
   have **Docker Compose v2** (the `docker compose` plugin, not the legacy `docker-compose` v1).
   The `docker-compose-plugin` apt package only exists in Docker's official apt repo; if Docker
   was installed from Ubuntu's `docker.io` package (as on the current server), drop the plugin
   binary in directly instead:

   ```bash
   sudo mkdir -p /usr/local/lib/docker/cli-plugins
   sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
     -o /usr/local/lib/docker/cli-plugins/docker-compose
   sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
   docker compose version   # must print v2.x
   ```

   > If the server was previously running Compose **v1** (`docker-compose`), migrate the stack
   > once after installing v2 — v1 and v2 name containers differently, so v2 won't reuse the v1
   > containers and would otherwise collide on the published ports:
   >
   > ```bash
   > cd /ecotaxadev2/ecopart/new_ecopart
   > docker-compose down      # remove the old v1 api + web containers (data_storage is a bind-mount, untouched)
   > docker compose up -d     # recreate both services under v2
   > ```

3. **Deployment directory** (`DEPLOY_DIR` in the workflow, set to
   `/ecotaxadev2/ecopart/new_ecopart`): the directory that already holds the test server's
   `docker-compose.yml`, its `.env`, and the persisted `data_storage/`. Update `DEPLOY_DIR` if
   this ever moves.

The job then runs, from that directory:

```bash
docker compose pull api      # pull the freshly published backend image
docker compose up -d api     # recreate ONLY the backend container (frontend `web` stays up)
```

Database migrations are applied automatically when the backend container boots, so the new
version is fully migrated after `up -d`.

**Isolation.** The job pulls and recreates only the `api` service and removes only the previous
backend image (and only if it changed and is no longer in use). The frontend, the compose file,
and every other image/container on the host are left untouched. No host-wide `docker image
prune` is run.


### Production Procedure

The test/production server runs the **frontend and backend together** from a single
`docker-compose.yml`, both pulling published images from Docker Hub:

```yaml
services:
  api:
    image: 'ecotaxa/ecopart_back:latest'
    env_file: .env
    volumes:
      - ./data_storage:/src/data_storage
    ports:
      - "5005:4000"
    restart: unless-stopped
  web:
    image: 'ecotaxa/ecopart_front:latest'
    ports:
      - "3000:3000"
    restart: unless-stopped
```

To set up or update the server manually:

1. **Prepare the environment**: copy `empty.env` to the server (next to the compose file) and
   rename it to `.env`, then set the variables. `data_storage/` persists the SQLite DB + files
   across redeploys.

2. **Run the stack**:

   ```bash
   docker compose pull && docker compose up -d
   ```

> Note: the root `docker-compose.yml` in this repository **builds the backend from source** and
> is for local development only. The server uses the image-based compose shown above.

### Link with EcoTaxa

### OpenAPI Documentation

The API is documented using the [OpenAPI 3.0](https://swagger.io/specification/) specification. Documentation is auto-generated from `@openapi` JSDoc annotations in the router files and YAML schema definitions.

**Interactive Swagger UI** is available at `/api-docs` when the server is running (disable it by setting `ENABLE_SWAGGER=false` in your `.env`). The raw JSON spec is served at `/api-docs.json`.

**Generate `openapi.json`** (static file at project root):

```bash
npm run openapi:generate
```

`openapi:generate` is also run automatically on every `git push` via a versioned `pre-push` hook (`.githooks/pre-push`).
If the generated `openapi.json` changed, the push is blocked so you can commit the updated file first.

**Validate the generated spec:**

```bash
npm run openapi:validate
```

**How it works:**
- Router annotations live in `src/presentation/routers/*.ts` as `@openapi` JSDoc blocks.
- Reusable schemas are defined in `src/presentation/openapi/schemas/*.yaml`.
- The base OpenAPI config is in `src/presentation/openapi/swagger-definition.ts`.
- `swagger-jsdoc` merges all of the above at runtime (Swagger UI) or build time (`tools/generateOpenApi.ts`).

When you add or modify an endpoint, add/update the `@openapi` annotation above it. If the request/response shape changes, update the corresponding YAML schema file as well.

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
