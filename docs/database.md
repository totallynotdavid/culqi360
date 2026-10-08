# Database development

Culqi360 stores application state in PostgreSQL. Development databases are
disposable: a schema change rebuilds the database instead of applying a chain of
incremental migrations.

## Initialize PostgreSQL

Run this once from the repository root after cloning:

```sh
bun run dev:infra:setup
```

The command initializes `.pgdata`, starts PostgreSQL long enough to create the
local `crm` database, then stops it. It does not create the application schema
or seed data.

Start development with:

```sh
bun run dev
```

The `dev` script of `apps/web` waits for PostgreSQL, runs `migrate` (creates the
schema when the database is empty), runs `seed` (provisions the installation and
loads development data, and skips if already initialized), then starts Vite.

## Reset the development database

With PostgreSQL running, run from the repository root:

```sh
bun run db:reset
```

It drops the database named in `WEB_DB_URL` (default `crm`), disconnecting its
clients, creates it empty, then runs `migrate` and `seed`. Restart the web
server and the worker afterwards. The command refuses to run with
`NODE_ENV=production`. It never recreates the `postgres` maintenance database.

To discard the whole local cluster instead, stop PostgreSQL, run
`bun run clean:db` (it removes `.pgdata` only) and repeat
`bun run dev:infra:setup`.

## Change the schema

Schema modules live in
[`schema/modules/`](../apps/web/src/server/platform/database/schema/modules/).
The table types of a module are in the `*.types.ts` file beside it
(`job-queues.ts` has none).
[`plan.ts`](../apps/web/src/server/platform/database/schema/plan.ts) orders the
modules.

After you change a schema module:

1. Update its matching database types.
2. Run `bun run db:reset`, which creates and seeds the new schema.
3. Restart the web server and the worker.
4. Run the focused tests for the changed domain.
5. Run `bun run check` for contract, generation, or cross-subsystem changes.

[`migrate.ts`](../apps/web/src/server/platform/database/migrate.ts) hashes the
schema and reference-data modules and stores the hash in the database. Startup
returns when the stored hash matches. It stops with an error that points at
`bun run db:reset` when a database holds a different hash.

## Run database commands directly

From `apps/web`:

```sh
bun run migrate
bun run seed
```

Production uses `migrate:prod` and `provision:prod`. Both read their
configuration from the process environment.

## End-to-end databases

The Playwright suite creates its own template and worker databases. It does not
use or reset the development `crm` database. See
[End-to-end testing](e2e-testing.md).
