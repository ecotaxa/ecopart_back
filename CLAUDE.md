# CLAUDE.md

Guidance for working in the EcoPart backend. It is an Express + TypeScript REST API
built with Clean Architecture and manual dependency injection, backed by SQLite.

## Commands

```bash
npm run dev:watch        # run the API with ts-node + nodemon (src/main.ts)
npm run dev:build        # clean + tsc + copy assets
npm run tsc              # type-check / compile only
npx tsc --noEmit         # fast type-check, no output (use this to verify changes)
npm run test-CI          # run the full jest suite once with coverage (CI mode)
npx jest <path>          # run a single test file
npx jest -t "<name>"     # run tests matching a name
npm run migrate:up       # apply DB migrations (also runs automatically on boot)
npm run openapi:generate # regenerate openapi.json from router annotations
```

Type-check after every change with `npx tsc --noEmit`. The IDE LSP can report stale
`Cannot find name 'expect'` / "unused import" diagnostics mid-edit — trust `tsc`, not the
transient hints.

## Architecture — layers, roles, dependency rule

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
    use-cases/<feature>/       Use-case implementations = business logic / orchestration
    repositories/              Repository implementations (compose a DataSource + infra adapters)
    constants/                 Domain constants
  data/
    interfaces/data-sources/   DataSource contracts (persistence ports)
    data-sources/sqlite/       SQLite implementations of DataSources
    migrations/                Numbered, idempotent migrations (NNN_description.ts)
  infra/                       Framework/IO adapters: auth (jwt), cryptography (bcrypt),
                               mailer, files (fs), countries — implement domain interfaces
  presentation/
    routers/                   Express routers: HTTP wiring + OpenAPI annotations only
    middleware/                Auth + express-validator request validation
    interfaces/middleware/     Middleware contracts
    openapi/                   Swagger definition
  main.ts                      Composition root: builds every concrete + injects (see below)
  server.ts                    Express app (json, cookies, logging, swagger). No routes here.
```

### Role of each layer
- **Entities**: data shapes only — no behavior, no IO. Note the variant convention:
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

## Dependency injection

DI is **manual constructor injection**, wired exactly once in `main.ts` (the composition
root). There is no DI container.

- Use cases and repositories declare their collaborators as constructor parameters typed as
  **interfaces**.
- `main.ts` instantiates DataSources → repositories → use cases → routers, passing concretes
  down. Config (env) is read only in `main.ts` and threaded through constructors (e.g.
  `DATA_STORAGE_FS_STORAGE`, secrets, base URLs) — do not read `process.env` deeper in.
- To add a dependency to a use case: add it as a constructor param (interface-typed), then
  update the single `new ...(...)` call in `main.ts`. Update e2e test harnesses too
  (`test/end-to-end/*.test.ts` re-wire the same graph by hand).

### Adding a feature end-to-end (checklist)
1. Entity variants in `domain/entities/` if new shapes are needed.
2. Port(s): add methods to `domain/interfaces/repositories/*` and/or
   `data/interfaces/data-sources/*`. Adding a method here **forces** updates to every
   implementation and every mock — that is the intended safety net.
3. Implement in `domain/repositories/*` and `data/data-sources/sqlite/*`.
4. Use-case contract in `domain/interfaces/use-cases/<feature>/`, implementation in
   `domain/use-cases/<feature>/`.
5. Validation middleware (`presentation/middleware/*-validation.ts`) + router
   (`presentation/routers/*-router.ts`) with OpenAPI annotations.
6. Wire everything in `main.ts`; mount the router with `server.use(...)`.
7. DB change? add a migration `src/data/migrations/NNN_*.ts` (idempotent `up`, reversible
   `down`; seed lookup tables with `INSERT OR IGNORE`).
8. Update mocks in `test/mocks/` for any new interface methods, then add tests.

## Conventions observed in this codebase
- **Async long-running work = Task pattern**: create a Task (`TaskType` enum + seeded in
  migration `000`/later), return it immediately, then run "fire-and-forget" updating
  progress via `taskRepository.startTask/updateTaskProgress/finishTask/failedTask/logMessage`.
  Results (e.g. ZIPs) are written under `<DATA_STORAGE_FOLDER>/tasks/<task_id>/` and streamed
  back via `GET /tasks/:task_id/file`. Mirror `export-backuped-project.ts` / `export-raw-data.ts`.
- **Authorization** lives in the use case: `userRepository.ensureUserCanBeUsed(user_id)` then
  admin-or-privilege via `userRepository.isAdmin` / `privilegeRepository.isGranted`.
- **Error handling**: use cases `throw new Error("<stable message>")`; routers match on
  `err.message` to choose the HTTP status. Keep messages stable — tests and routers depend on them.
- **Search/filtering**: repositories whitelist allowed filter/sort fields and use
  `PreparedSearchOptions` (`{ filter, sort_by, page, limit }`); `IN` filters take an array value.
- Prefer minimal, targeted changes; do not add comments that merely restate code.

## Testing

- Framework: **Jest + ts-jest** (`jest.config.js`, tsconfig `tsconfig.test.json`).
- **Unit tests** for use cases live in `test/domain/use-cases/<feature>/`. They inject the
  hand-written mocks from `test/mocks/` (`MockUserRepository`, `MockSampleRepository`,
  `MockTaskRepository`, …). Pattern:
  - `beforeEach`: `jest.clearAllMocks()`, `new Mock...()` for each repo, construct the use case.
  - Use `jest.spyOn(mockRepo, "method").mockImplementation(...)` / `.mockResolvedValueOnce(...)`.
  - Assert both the thrown/returned result **and** that collaborators were (not) called, with
    `toBeCalledWith` / `toBeCalledTimes(0)` to prove the control flow stopped where expected.
  - Reusable entity fixtures live in `test/entities/`.
- **Mocks must stay in sync with ports**: every repository/datasource interface has a
  `implements`-ing mock class. When you add an interface method, add a stub
  (`throw new Error("Method not implemented for <name>")`) to the mock, or the whole test
  suite fails to compile.
- **End-to-end tests** (`test/end-to-end/import_uvp5.test.ts`, `import_uvp6.test.ts`) boot the
  real app graph (real repositories + a temp SQLite DB + real migrations), drive it through
  supertest, and require the live EcoTaxa **dev** instance plus the on-disk import dataset —
  so they only pass in an environment that has both. They run as an ordered sequence
  (`capturedProjectId`, sample ids, etc. are set by earlier phases), so a single phase cannot
  be run in isolation with `-t`. UVP5 raw LPM artifacts are `<sample>_work.zip` +
  `<sample>_meta_conf.zip`; UVP6 are `<sample>_Particule.zip` (+ `<sample>_Images.zip`).
- Always run `npx tsc --noEmit` (and the relevant jest file) before declaring a change done.
  Note: three pre-existing arg-count errors in `project-router`/`*-validation` tests are
  unrelated to current work — don't be alarmed by them, but don't add new ones.
