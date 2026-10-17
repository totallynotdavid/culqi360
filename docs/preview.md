# Authenticated preview

`mise run preview` starts a separate web server on a seeded database and prints
a session cookie for a chosen user. Use it to open a signed-in page without
typing credentials, in a browser or with `bunx agent-browser`.

PostgreSQL must be running (`mise run dev:infra`), and `.env` must be filled in
as described in [configuration](web-configuration.md). Run from the repository
root:

```sh
mise run preview                      # list roles and their user counts
mise run preview --role <role>        # a user with that role
mise run preview --as <username>      # a specific seeded user
mise run preview --json --role <role> # machine-readable output
mise run preview --fresh              # rebuild the preview database first
mise run preview stop                 # stop the preview server
```

The output gives the base URL, the session cookie name and value, and the
`agent-browser` commands that open `/login`, set the cookie, open `/home` and
take a screenshot.

## What it creates

- The database `crm_preview` on the server named by `WEB_DB_URL`. It is never
  the development `crm` database.
- A web server on `http://127.0.0.1:3900`, started in the background. Its log is
  `apps/web/.preview-server.log` and its process record is
  `apps/web/.preview-server.json`.
- A 30-day session for every active seeded user. Tokens derive from the
  username, so they stay the same after a reseed.

The server runs with `NOTIFICATION_ROUTES=email:log`, so no message leaves the
machine. Uploads go to `apps/web/.preview-storage/documents`.

The database is rebuilt and reseeded when it does not exist, when `--fresh` is
passed, or when a file under `apps/web/src/server/platform/database/schema` or
`apps/web/src/server/platform/database/seeds` changed since the last build. The
first start can take minutes while Vite pre-bundles dependencies.
