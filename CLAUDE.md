# CLAUDE.md

Guidance for working in the EcoPart backend: an Express + TypeScript REST API built with Clean
Architecture and manual dependency injection, backed by SQLite. The frontend lives in the
`ecotaxa/ecopart_front` repository and talks only to this API. Several developers work on this
repository: follow the conventions below so that the code stays uniform.

Where things are written down:
- This file: code organisation, conventions, testing, git workflow and releases.
- `README.md`: operations (Docker image, test and preprod deployment, remote import folders,
  EcoTaxa token encryption, migration runner details). Do not duplicate it here.
- `docs/`: functional specifications and analyses (export products and the UVP6 pivot, Argo export
  comparison, export page mockup, raw export todo).
- `TODO.md`: known gaps not scheduled yet. Remove an item once it is done, add one when a change
  leaves a gap on purpose.
- `RELEASE_NOTES.md` has not been updated since March 2025: git tags and commit messages are the
  changelog.
- The legacy Python EcoPart (`github.com/ecotaxa/ecopart`) is the reference for the import
  algorithms, the QC graphs and the histogram definitions, bounds and constants.

## Commands

```bash
npm install              # also installs the versioned git hooks (.githooks, see OpenAPI)
npm run dev:watch        # run the API with ts-node + nodemon (src/main.ts)
npm run dev:build        # clean + tsc + copy assets
npm run prod:build       # what the Docker image runs: rimraf dist + tsc + copy assets
npx tsc --noEmit         # fast type-check of src, no output (use this to verify changes)
npm run typecheck        # type-check src and tests together (CI runs it)
npm run lint             # eslint on src: errors fail, warnings (no-explicit-any) are tolerated
npm run test-CI          # run the full jest suite once with coverage (CI mode)
npm test                 # same in WATCH mode: do not use it in a script or an agent
npx jest <path>          # run a single test file
npx jest -t "<name>"     # run tests matching a name
npm run migrate:create -- <name>   # create the next numbered migration file
npm run migrate:up / :down / :status
npm run openapi:generate # regenerate openapi.json from router annotations
npm run openapi:validate # validate openapi.json
npx ts-node tools/buildLakes.ts    # rebuild src/infra/geography/data/ne-10m-lakes.json (rarely)
```

Type-check after every change with `npx tsc --noEmit`. The IDE LSP can report stale
`Cannot find name 'expect'` / "unused import" diagnostics mid-edit: trust `tsc`, not the
transient hints.

## Local setup

- Node 22 in CI and in the Docker image (`node:22-trixie`). Node 20 works locally.
- Copy `empty.env` to `.env`. For local work: `NODE_ENV=DEV`, `PORT_LOCAL=4000`,
  `API_URL=http://localhost:4000`, a `DBSOURCE_NAME`, the `data_storage/...` paths as in the
  template, any string for the four token secrets. `ACCESS_TOKEN_SECRET` and
  `REFRESH_TOKEN_SECRET` are required: the server refuses to start without them. Missing storage
  folders are created at boot.
- `NODE_ENV=DEV` diverts every outgoing e-mail to `TEST_MAIL_DEFAULT_RECIPIENT` (empty = send for
  real) and accepts self-signed EcoTaxa certificates. Servers run `NODE_ENV=PROD`.
- Swagger UI at `/api-docs` (off with `ENABLE_SWAGGER=false`), raw spec at `/api-docs.json`, the
  running version at `GET /version` (`dev` outside Docker).
- `docker compose up` at the repository root builds the image from source, for local use only.
  Servers run the published image (README).
- Unit tests need no `.env` (`test/setup-env.ts`). End-to-end tests need more, see Testing.

### Environment variables (read once in `main.ts`)

| Variable | Role |
| --- | --- |
| `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` | JWT secrets of the login cookies. Required. |
| `VALIDATION_TOKEN_SECRET`, `RESET_PASSWORD_TOKEN_SECRET` | Account validation and password reset links. Empty = those e-mails fail. |
| `NODE_ENV` | `DEV` or `PROD` (see above). Not Express's `production`. |
| `PORT_LOCAL`, `BASE_URL_LOCAL`, `API_URL` | Listening port, local base URL, public API URL (used in e-mails and task results). |
| `DBSOURCE_FOLDER`, `DBSOURCE_NAME` | SQLite file. |
| `DATA_STORAGE_FOLDER` | Root of everything persistent: `tasks/<task_id>/`, `migrations.log`. |
| `DATA_STORAGE_FS_STORAGE` | Imported sample files: `<project_id>/<sample_name>/` (raw files, `pivot/<sample>_Particule.zip`), `<project_id>/l0b_backup/`. |
| `DATA_STORAGE_IMPORT` | Import sources; the import browser lists `remote/` (symlinks allowed, README). |
| `DATA_STORAGE_EXPORT` | Export working folder. |
| `GENERIC_ECOTAXA_ACCOUNT_EMAIL`, `ECOPART_USER_*` | The EcoPart application user, seeded at boot, that owns the generic EcoTaxa accounts. |
| `ECOTAXA_TOKEN_ENCRYPTION_KEY` | AES-256-GCM key for EcoTaxa tokens at rest. Empty locally. Malformed = startup failure. |
| `ECOTAXA_ALLOW_SELF_SIGNED_CERT` | Only for a local EcoTaxa. Implied by `NODE_ENV=DEV`. |
| `TEST_MAIL_DEFAULT_RECIPIENT`, `MAIL_*` | Mail diversion outside PROD, SMTP transport. |
| `ENABLE_SWAGGER` | `false` disables `/api-docs`. |
| `APP_VERSION` | Set by the Docker build from the git tag. Never set it by hand. |

## Architecture: layers, roles, dependency rule

Dependencies point **inward only**: `presentation → domain ← data`, `infra → domain`.
The domain layer depends on nothing concrete; everything crossing a layer boundary goes
through an interface defined in the inner layer.

```
src/
  domain/                      ← core, no framework/IO knowledge
    entities/                  Plain TS models + enums (Request/Response/Update/Public/Private variants)
    interfaces/
      repositories/            Repository contracts (the ports the domain depends on)
      use-cases/<feature>/     Use-case contracts (one interface per use case)
      geography/               Land mask port
    use-cases/<feature>/       Use-case implementations = business logic / orchestration
    repositories/              Repository implementations (compose a DataSource + infra adapters)
    constants/                 Domain constants (size classes, export formats, task types, CTD columns)
    utils/                     Pure helpers (privacy, pivot converter, path containment, text decoding)
  data/
    interfaces/data-sources/   DataSource contracts (persistence ports)
    data-sources/sqlite/       SQLite implementations of DataSources (+ sql-identifier.ts)
    migrations/                Numbered, idempotent migrations (NNN_description.ts) + runner + logger
  infra/                       Framework/IO adapters: auth (jwt), cryptography (bcrypt, AES token
                               cipher), mailer (nodemailer + html templates), files (fs), countries,
                               geography (Natural Earth land mask) ; implement domain interfaces
  presentation/
    routers/                   Express routers: HTTP wiring + OpenAPI annotations only
    middleware/                Auth cookie, express-validator rules, rate limit, 404/error handlers
    interfaces/middleware/     Middleware contracts (so router tests can swap them)
    openapi/                   Swagger definition + YAML schemas
  main.ts                      Composition root: builds every concrete + injects (see below)
  server.ts                    Express app (compression, json, cookies, swagger). No routes here.
tools/                         ts-node scripts: migrate CLI, OpenAPI generation, asset copy, lakes
test/                          Mirrors src/ (see Testing)
```

### Role of each layer
- **Entities**: data shapes only, no behavior, no IO. Note the variant convention:
  `...RequestCreationModel` (create input), `...RequestModel` (lookup/partial),
  `...UpdateModel` (mutation), `...ResponseModel` (full DB row), `Public...` (API-facing),
  `Private...` (internal). Match the right variant rather than widening types.
- **Use cases**: the only place business rules live. They orchestrate repositories and
  enforce authorization. They receive dependencies via the constructor and depend on
  **interfaces**, never on concrete classes or Express types (`Request`/`Response` do not
  belong here, except the deliberate file-streaming use case).
- **Repositories**: translate between domain operations and a DataSource; may also call
  infra adapters and external HTTP APIs. Implement a `domain/interfaces/repositories` port.
- **DataSources**: raw persistence (SQLite). Implement a `data/interfaces/data-sources` port.
- **Routers/Middleware**: parse/validate HTTP, call a use case, map domain errors to status
  codes. No business logic.

### Naming
- Files: kebab-case, `<feature>-<thing>.ts`; feature folders keep the DB table name
  (`ecotaxa_account`, `broadcast_message`).
- Classes: `PascalCase`. Repositories `XxxRepositoryImpl`, data sources `SQLiteXxxDataSource`,
  use cases `Xxx` with contract `XxxUseCase`, validation middleware `MiddlewareXxxValidation` with
  contract `IMiddlewareXxxValidation`, infra adapters `XxxAdapter`, mocks `MockXxx`.
- DB columns, entity fields, query parameters and JSON bodies: `snake_case`. Dates in
  `*_utc_date_time` columns, ISO 8601 strings in UTC.
- Code, comments, API messages and commit messages in English (see Git workflow).

## Dependency injection

DI is **manual constructor injection**, wired exactly once in `main.ts` (the composition
root). There is no DI container.

- Use cases and repositories declare their collaborators as constructor parameters typed as
  **interfaces**.
- `main.ts` instantiates DataSources → repositories → use cases → routers, passing concretes
  down. Config (env) is read only in `main.ts` and threaded through constructors (e.g.
  `DATA_STORAGE_FS_STORAGE`, secrets, base URLs): do not read `process.env` deeper in.
- To add a dependency to a use case: add it as a constructor param (interface-typed), then
  update the single `new ...(...)` call in `main.ts`. Update e2e test harnesses too
  (`test/end-to-end/*.test.ts` re-wire the same graph by hand).

### Startup sequence (`main.ts`)
1. Version log, required secrets check, storage folders created.
2. SQLite opened with `PRAGMA foreign_keys = ON` and a 5 s busy timeout.
3. Migrations run; a failure stops the process (the container restarts, the failure is visible).
4. The EcoPart application user is seeded, ended login sessions purged.
5. `RecoverInterruptedTasks`: tasks still active from the previous run are closed and their
   leftovers removed. Must run before any route exists.
6. EcoTaxa token cipher built, tokens stored in clear encrypted if a key is set.
7. Rate limits, routers, then the Explore EcoTaxa sweeper; `notFoundHandler` and `errorHandler`
   last so that every answer is JSON.
Unhandled promise rejections are logged, never fatal: a crash would interrupt every running task.

### Adding a feature end-to-end (checklist)
1. Entity variants in `domain/entities/` if new shapes are needed.
2. Port(s): add methods to `domain/interfaces/repositories/*` and/or
   `data/interfaces/data-sources/*`. Adding a method here **forces** updates to every
   implementation and every mock: that is the intended safety net.
3. Implement in `domain/repositories/*` and `data/data-sources/sqlite/*`.
4. Use-case contract in `domain/interfaces/use-cases/<feature>/`, implementation in
   `domain/use-cases/<feature>/`.
5. Validation middleware (`presentation/middleware/*-validation.ts`) + router
   (`presentation/routers/*-router.ts`) with OpenAPI annotations, then `npm run openapi:generate`
   and commit `openapi.json`.
6. Wire everything in `main.ts`; mount the router with `server.use(...)`.
7. DB change? add a migration (see Database and migrations).
8. Update mocks in `test/mocks/` for any new interface methods, then add tests (use case, router,
   migration if it transforms data).
9. If the front needs the change, open the matching front branch; releases go in pairs.

## HTTP conventions

- **Auth**: JWT access + refresh tokens in cookies, checked by `MiddlewareAuthCookie.auth`; login
  sessions are stored (`user_session`) so that logout and purge work. Every route needs a login,
  Explore included (its anonymous access was removed on 4 Nov 2026): an anonymous user never
  reaches a use case.
- **Validation**: express-validator rule arrays in `presentation/middleware/*-validation.ts`,
  exposed through an interface so router tests can replace them with empty rules.
- **Errors**: always `{ errors: [string] }`. Unknown route = 404, malformed JSON = 400, anything a
  router did not catch = 500 without a stack trace.
- **Body size**: 100 KB default, 5 MB on `/exports` (sample id lists). Responses are gzipped.
- **Rate limits** (`presentation/middleware/rate-limit.ts`): in-memory fixed windows, counted per
  target e-mail (behind the reverse proxy every request may share one IP), on `POST /auth/login`,
  `POST /auth/password/reset`, `POST /users`. Registered before the routers in `main.ts`.
- **Search routes**: body or query `{ filter, sort_by, page, limit }`; see Conventions.

## Domain concepts

- **Project**: metadata, named roles (data owner, operator, chief scientist, matched by e-mail
  and granted automatically: `project-named-roles.ts`), privileges (managers, members, one
  contact) and three privacy durations. The **privacy level** `private | visible | public | open`
  is computed from the **oldest sample date**, never from the creation date
  (`domain/utils/project-privacy.ts`). What a role may do at each level is the matrix in
  `use-cases/project/project-access.ts` (`ProjectAccessPolicy`): use it, do not re-derive rules
  in a use case.
- **Sample**: one UVP profile (depth) or time series, of an instrument model seeded in migration
  000 (UVP5HD/SD/Z, UVP6LP/HF/MHP/MHF). UVP5 raw artefacts are `<sample>_work.zip` +
  `<sample>_meta_conf.zip`; UVP6 are `<sample>_Particule.zip` (+ `<sample>_Images.zip`). Every
  computed product reads the **UVP6 pivot format**: UVP5 samples are converted at import
  (`domain/utils/uvp5-pivot-converter.ts`) into `pivot/<sample>_Particule.zip`, regenerable with
  the `REGENERATE_PIVOT` task. The import QC graphs keep reading the native files. A sample
  carries a visual QC (validated / rejected, audited) and particle stats computed at import.
- **Import** (`use-cases/sample/import-samples.ts`): 4 logged steps. 1 validation, with every
  pre-check done **before** any copy and a per-sample reason when a sample is refused; 2 copy of
  the sample folders into `DATA_STORAGE_FS_STORAGE`; 3 pivot + particle stats; 4 DB rows. Then,
  separately, CTD import and EcoTaxa import (files uploaded to the generic account's EcoTaxa file
  space, job polled).
- **Exports**: binned (`POST /exports/binned`, task type `EXPORT`), raw archive (`EXPORT_RAW`),
  project backup (`BACKUP`, `EXPORT_BACKUP`); `format` tsv or parquet for generated tables. The
  raw export returns the files as they were imported: metadata edited in EcoPart is not
  propagated into them (decision deferred). Units follow the export spec in `docs/` (pixel size
  in mm, pressure in dbar).
- **Explore**: cross-project selection, map, stats and curves, for logged-in users.
  EcoTaxa figures are kept per sample (`sample_ecotaxa_stats`), refreshed at most once a day by a
  background sweeper, with at most 2 EcoTaxa calls in flight and batches of 50
  (`use-cases/explore/explore-ecotaxa.ts`). Project stats (STATS tab) and the QC state of the
  project lists reuse the same warnings.
- **EcoTaxa**: every call to EcoTaxa lives in `domain/repositories/ecotaxa_account-repository.ts`
  (`fetchWithAgent`); **the front never calls EcoTaxa itself**, it goes through this API. Users
  link one EcoTaxa account per instance; imports, reads, deletions use the instance's **generic
  account** (owned by the seeded EcoPart user). Tokens are encrypted at rest. `PATCH
  /api/projects` only touches the fields sent, but sending `managers` drops the contact flag unless
  `contact` is sent too.
- **Tasks**, **notifications** (the owner is notified when a task ends), **broadcast message**
  (admin banner), **admin stats**: see the Task pattern below.

## Conventions observed in this codebase
- **Async long-running work = Task pattern**: create a Task (`TaskType` enum + seeded in
  migration `000`/later), return it immediately, then run "fire-and-forget" updating
  progress via `taskRepository.startTask/updateTaskProgress/finishTask/failedTask/logMessage`.
  Results (e.g. ZIPs) are written under `<DATA_STORAGE_FOLDER>/tasks/<task_id>/` and streamed
  back via `GET /tasks/:task_id/file`. Mirror `export-backuped-project.ts` / `export-raw-data.ts`.
  Return `taskRepository.toPublicTask(task)` (never the log file path). Call
  `taskRepository.throwIfCancelled(task_id)` between steps, only where the catch path removes what
  the task produced so far (never after irreversible writes such as created samples); `failedTask`
  turns that error into `CANCELLED`. Interrupted tasks are recovered at startup (`RecoverInterruptedTasks`,
  error `TASK_INTERRUPTED_MESSAGE`), which also removes what they left: write files under a temporary name (`.partial`, pivot `.tmp`,
  `.staging` folder) then rename, so a cut-short write is recognisable and never mistaken for a complete one.
  Task logs are detailed (`Step n/m <name> : <what happened>`, `WARNING` lines for degraded
  results) and **never contain a server path**: neither the log, nor `task_error`, nor
  `task_result`; paths under the FTP folder are given relative to it.
- **Authorization** lives in the use case: `userRepository.ensureUserCanBeUsed(user_id)` then
  admin-or-privilege via `userRepository.isAdmin` / `privilegeRepository.isGranted`, or
  `ProjectAccessPolicy` when the privacy level matters.
- **Error handling**: use cases `throw new Error("<stable message>")`; routers match on
  `err.message` to choose the HTTP status. Keep messages stable: tests and routers depend on them.
  `test/presentation/routes/router-error-messages.test.ts` checks that every message a router
  compares is thrown somewhere; fix the message on one side rather than extending its
  `KNOWN_UNREACHABLE` list. Error messages shown to users say what to check and what to relaunch.
- **Missing values are NULL**: an absent measure is stored and exported as `NULL`, never `0`,
  `-Infinity` or a legacy fallback.
- **Search/filtering**: repositories whitelist allowed filter/sort fields and use
  `PreparedSearchOptions` (`{ filter, sort_by, page, limit }`); `IN` filters take an array value
  and an empty `IN` must match nothing (see the project data source), never everything. Dynamic
  SQL identifiers go through `sqlIdentifier()`.
- **Files**: user-supplied paths are checked with `isInsideFolder` (`domain/utils/path-containment.ts`)
  except the deliberate `remote/` symlinks; large text files are streamed line by line
  (`text-lines.ts`, `zstd-stream.ts`), never read whole (a TSV over 512 MiB crashed preprod once).
- **Logging**: `console.log(new Date().toISOString(), ...)`, no logger library. Task-level
  events go to the task log, not the console.
- **External HTTP**: `node-fetch` v3 (ESM) through `fetchWithAgent`; EcoTaxa only, nowhere else.
- Comments explain a why or a non-obvious constraint, never restate the code. Prefer minimal,
  targeted changes.

## Testing

- Framework: **Jest + ts-jest** (`jest.config.js`, tsconfig `tsconfig.test.json`). About 165 test
  files; `test/` mirrors `src/`. Coverage excludes `infra/` and `entities/`. ESM-only packages
  must be listed in `transformIgnorePatterns` (node-fetch, hyparquet...) or Jest cannot load them.
- **Unit tests** for use cases live in `test/domain/use-cases/<feature>/`. They inject the
  hand-written mocks from `test/mocks/<feature>-mock.ts` (`MockUserRepository`,
  `MockSampleRepository`, `MockTaskRepository`, …, and `MockXxxUseCase` for routers). Pattern:
  - `beforeEach`: `jest.clearAllMocks()`, `new Mock...()` for each repo, construct the use case.
  - Use `jest.spyOn(mockRepo, "method").mockImplementation(...)` / `.mockResolvedValueOnce(...)`.
  - Assert both the thrown/returned result **and** that collaborators were (not) called, with
    `toBeCalledWith` / `toBeCalledTimes(0)` to prove the control flow stopped where expected.
  - Test names read `<situation> : ok|ko`. Reusable entity fixtures live in `test/entities/`.
- **Router tests** (`test/presentation/routes/`): supertest on `src/server`, the router mounted
  with mock use cases, a `MockMiddlewareAuth` that sets `req.token` and validation middleware with
  empty rule arrays; assert the status, the body and what the use case was called with.
- **Repository and data-source tests** (`test/domain/repositories/`, `test/data/data-sources/`):
  real classes on a temp folder; `*.integration.test.ts` open an in-memory SQLite (`:memory:`)
  and run the real migrations.
- **Migration tests** (`test/data/migrations/`): every migration that transforms data gets one
  (schema before, rows, `up`, assertions, `down`).
- **Mocks must stay in sync with ports**: every repository/datasource interface has a
  `implements`-ing mock class. When you add an interface method, add a stub
  (`throw new Error("Method not implemented for <name>")`) to the mock, or the whole test
  suite fails to compile.
- **End-to-end tests** (`test/end-to-end/import_uvp5.test.ts`, `import_uvp6.test.ts`) boot the
  real app graph (real repositories + a temp SQLite DB + real migrations), drive it through
  supertest, and require the live EcoTaxa **dev** instance (`https://ecotaxa-dev.imev-mer.fr:5003/`)
  plus the on-disk import dataset under `data_storage/ecopart_data_to_import/remote/ftp_plankton/`.
  When either is missing the suite is **skipped**, not failed (`ecotaxa-availability.ts`): a green
  run on CI says nothing about them. They run as an ordered sequence
  (`capturedProjectId`, sample ids, etc. are set by earlier phases), so a single phase cannot
  be run in isolation with `-t`.
- Helpers in `test/helpers/`: build zip and `.tar.zst` fixtures, read a zip entry, read a Parquet
  table back.
- Always run `npm run typecheck`, `npm run lint` and the relevant jest files before declaring a
  change done; `npm run test-CI` before a merge. They are clean on src and tests: keep it that way.
- No `.env` is needed for unit tests: `test/setup-env.ts` gives the test JWT secrets the values CI uses.

## OpenAPI

- Every route carries an `@openapi` JSDoc block in its router; reusable schemas are YAML files in
  `src/presentation/openapi/schemas/`; `swagger-definition.ts` merges them (served live at
  `/api-docs`, written to `openapi.json` by `npm run openapi:generate`).
- `openapi.json` is committed and must match the code: the `pre-push` hook regenerates it and
  blocks the push when it changed, and the `Tests CI` workflow fails on a stale file. Regenerate
  and commit it with the change that touches a route or a schema.

## Database and migrations

- SQLite, one file, single writer: keep write transactions short, never hold one across an await
  on the network. Data sources use the `sqlite3` callback API wrapped in promises.
- Migrations live in `src/data/migrations/NNN_description.ts`, run in alphabetical order at boot
  (and with `npm run migrate:up`), each in a transaction, recorded in `_migrations`. Rules:
  idempotent `up`, reversible `down` (or a comment saying why not), seed lookup tables with
  `INSERT OR IGNORE`, no `BEGIN`/`COMMIT`/`PRAGMA foreign_keys` inside, `foreignKeysOff: true`
  when a table is rebuilt. Details and the log format are in the README.
- `npm run migrate:create -- <name>` picks the next number. Two branches can pick the same one:
  check `ls src/data/migrations | tail` before merging and renumber yours if needed. When the
  duplicate is found after a release (it is already recorded under the old id on a server), still
  renumber it, keep its `up` idempotent and have `up` delete the stale `_migrations` row of the
  former id, as `039_add_delete_task_types` does.
- A new task type, status or instrument model is a migration (`INSERT OR IGNORE` into the lookup
  table) plus the matching enum value in `domain/entities/`.
- Schema changes that alter what an existing column means (unit, format) come with a backfill
  migration and its test (`030_uvp6_pixel_size_in_mm`, `018_backfill_utc_date_time_iso_format`
  are models).

## Git workflow and releases

- `main` is the integration branch; nothing deploys from a merge alone. One branch per change,
  from `main`, snake_case name saying what it does (`export_task_logs`, `fix_large_text_crash`).
  Several branches live in parallel: `git worktree add ../ecopart_back_<branch> <branch>` then
  `npm install` in the worktree (tests run without `.env`).
- Commit messages, in English: `FEAT - <Area>: <what changed, as a user would say it>`,
  `FIX - ...`, `DEV - ...` for internal work. One meaningful commit per branch is the norm; squash
  fix-ups before merging.
- Merge into `main` with `git merge --no-ff origin/<branch>` or a GitHub PR targeting `main`.
  The `Tests CI` workflow (typecheck, lint, tests, OpenAPI freshness, Codecov) runs on PRs and on
  pushes to `main`; do not merge red.
- **Release** = an annotated tag on the merge commit: `git tag -a v0.0.N -m "<summary>"` then
  `git push --follow-tags`. Find the last number with `git tag --sort=-v:refname | head -1`. The
  `public.yml` workflow reruns the checks, builds the multi-arch image, pushes
  `ecotaxa/ecopart_back:v0.0.N` and `:latest`, and **redeploys the test server**. Preprod is
  promoted by hand from the GitHub Actions page (`Deploy to preprod server`, version as input).
  Any other server follows the manual compose procedure in the README.
- The front has its own tag sequence (`ecopart_front`): a change that needs both sides ships as a
  pair of tags, back first. When a release needs a step after deploy (a migration that cannot
  backfill, an admin route to call such as `POST /admin/samples/particle-stats`), put it in the
  tag message.
- Never commit `.env`, `prod.env`, `data_storage/`, `*.db`, `dist/`, `coverage/` (all ignored),
  nor data files dropped at the root for an analysis (zip, pdf, png). Secrets live only in the
  servers' `.env`.

## Gotchas

- `npm test` is watch mode and never exits; use `npm run test-CI` or `npx jest <path>`.
- A migration that fails stops the server: test it on a copy of a real database before tagging
  (`npm run migrate:up` with `.env` pointing at the copy).
- `RecoverInterruptedTasks` deletes what an interrupted task left: a task that writes final files
  under their final name loses them at the next restart. Write `.partial`/`.tmp` then rename.
- Rate limit counters and Explore caches are in memory: a restart resets them, and the API must
  stay a single process.
- Import `remote/` symlinks are followed wherever they point (deliberate): only admins may create
  them, and the container must bind-mount the link targets at the same path (README).
- The generic EcoTaxa account is a single point of failure with no monitoring (`TODO.md`): an
  import failing with an EcoTaxa error often means its token expired, log it in again from the
  EcoPart user that owns it.
- The e2e suites are the only tests that touch EcoTaxa; the unit suite can be green while an
  EcoTaxa integration is broken. Try the change against EcoTaxa dev when it touches
  `ecotaxa_account-repository.ts`.
