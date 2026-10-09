# End-to-end testing

The Playwright suite runs a built Culqi360 server against PostgreSQL. It uses
seeded sessions and the `email:log` notification route. It does not start or
replace the engine, so it does not cover engine-backed search.

## Run the suite

Install the browser once. On Linux, `--with-deps` also installs its system
libraries and asks for `sudo` itself:

```sh
cd apps/web
bunx playwright install --with-deps chromium
```

Start PostgreSQL, then run from `apps/web`:

```sh
bun run test:e2e
bun run test:e2e:headed
bun run test:e2e:ui
```

The commands load `.env.test`. `WEB_DB_URL` must point to a reachable local
PostgreSQL server.

## How it runs

Playwright global setup runs [`prepare.ts`](../apps/web/tools/e2e/prepare.ts).
The script builds the application when the build is stale, creates a seeded
template database, and writes the worker manifest. Global teardown drops the
template and every worker database.

Each Playwright worker clones the template database and starts its own built
server on port 41100 plus the worker index. An automatic fixture resets that
worker database before every test. Workers do not share database state. The
suite runs 4 workers, or 2 when `CI` is set.

Each worker server also gets its own `WEB_UPLOADS_ROOT`, a temporary directory
that is removed when the worker stops.

## Authentication and external services

`prepare.ts` seeds one user for every role in
[`roster.ts`](../apps/web/tests/e2e/roster.ts). Role fixtures create browser
contexts with the matching session cookie; they do not submit the login form.

The page fixtures are `asExecutive`, `asBackOffice`, `asManager`, `asAdmin`, and
`asSuperuser`. `signInAs(key)` accepts any roster key.

The built server runs with `NOTIFICATION_ROUTES=email:log`. That route writes
each composed email to the server log as `email.logged` and sends nothing. There
is no mailbox helper; a test that needs an invite link reads it from the page.

## Write a test

Import `test` and `expect` from
[`fixtures.ts`](../apps/web/tests/e2e/fixtures.ts). Use a role fixture unless
the test is about authentication.

```ts
test("shows the records workspace to an executive", async ({ asExecutive }) => {
  await asExecutive.goto("/records");
  await expect(asExecutive).not.toHaveURL(/\/login/);
});
```

Create state through Culqi360 when you test user behavior. Query
`workerDb.db.client` only for results the UI does not expose.

## Files

| Path                                                                       | Purpose                                            |
| -------------------------------------------------------------------------- | -------------------------------------------------- |
| [`tools/e2e/prepare.ts`](../apps/web/tools/e2e/prepare.ts)                 | Builds Culqi360 and creates the template database. |
| [`tests/e2e/roster.ts`](../apps/web/tests/e2e/roster.ts)                   | Defines seeded users and sessions.                 |
| [`tests/e2e/global-setup.ts`](../apps/web/tests/e2e/global-setup.ts)       | Runs `prepare.ts` before the suite.                |
| [`tests/e2e/global-teardown.ts`](../apps/web/tests/e2e/global-teardown.ts) | Drops the template and worker databases.           |
| [`tests/e2e/manifest.ts`](../apps/web/tests/e2e/manifest.ts)               | Shares prepared paths and reset data with workers. |
| [`tests/e2e/db.ts`](../apps/web/tests/e2e/db.ts)                           | Clones, resets, and drops worker databases.        |
| [`tests/e2e/server.ts`](../apps/web/tests/e2e/server.ts)                   | Starts one built server per worker.                |
| [`tests/e2e/fixtures.ts`](../apps/web/tests/e2e/fixtures.ts)               | Owns the worker lifecycle and authentication.      |
| [`tests/e2e/*.spec.ts`](../apps/web/tests/e2e/)                            | Contains the browser tests.                        |
