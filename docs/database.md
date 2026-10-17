# Database development

Culqi360 stores application state in PostgreSQL. Development databases are
disposable: a schema change rebuilds the database from the current schema.

## Initialize PostgreSQL

Run this once from the repository root after cloning:

```sh
mise run dev:infra:setup
```

The command initializes `.pgdata`, starts PostgreSQL long enough to create the
local `crm` database, then stops it. It does not create the application schema
or seed data.

Start development with:

```sh
mise run dev
```

The `dev` script of `apps/web` waits for PostgreSQL, initializes the current
schema, runs the installation seed (which loads development data and skips if
already initialized), then starts Vite.

## Reset the development database

With PostgreSQL running, run from the repository root:

```sh
mise run db:reset
```

It drops the database named in `WEB_DB_URL` (default `crm`), disconnecting its
clients, creates it empty, then initializes the current schema and runs the
seed. Restart the web server and the worker afterwards. The command refuses to
run with `NODE_ENV=production`. It never recreates the `postgres` maintenance
database.

To discard the whole local cluster instead, stop PostgreSQL, run
`mise run clean:db` (it removes `.pgdata` only) and repeat
`mise run dev:infra:setup`.

## Change the schema

Schema modules live in
[`schema/modules/`](../apps/web/src/server/platform/database/schema/modules/).
The table types of a module are in the `*.types.ts` file beside it
(`job-queues.ts` has none).
[`plan.ts`](../apps/web/src/server/platform/database/schema/plan.ts) orders the
modules.

After you change a schema module:

1. Update its matching database types.
2. Run `mise run db:reset`, which creates and seeds the new schema.
3. Restart the web server and the worker.
4. Run the focused tests for the changed domain.
5. Run `mise run check` for contract, generation, or cross-subsystem changes.

Schema initialization (the `migrate` script of `apps/web`, which `dev` and
`db:reset` run) builds an empty database and records a hash of the schema
modules. On a database that is already built it compares that hash with the
current code and stops with an error that points at `mise run db:reset` when
they differ. The running web server and worker do not check.

In production the `prepare` service runs the same initialization
([Deployment](deployment.md#application-stack)). A deployment that changes the
schema therefore stops at `prepare`, because there are no migrations and
`db:reset` refuses production.

## End-to-end databases

The Playwright suite creates its own template and worker databases. It does not
use or reset the development `crm` database. See
[End-to-end testing](e2e-testing.md).

## Test databases

The web test setup acquires a disposable PostgreSQL server for local managed
test runs. Its state defaults to `.vitest-db/postgres-server` in the checkout.
`TEST_DB_SERVER_ROOT` is a test-only override for that managed-server root. Use
it when a test needs its server state in a temporary directory or needs multiple
processes to share one managed server. It does not configure the development
database or the CI service database.
