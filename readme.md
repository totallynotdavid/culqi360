# Culqi360

Culqi360 is Infinity's internal sales CRM. Sales teams use it to work assigned
customers, search contact data and track merchant results. This repository holds
the web application, the contact-data pipeline, the search engine and the
browser extension for call work.

PostgreSQL is the system of record for CRM state. The pipeline builds a SQLite
contacts database. The engine serves that database to the web application over
signed HTTP.

## Get started

You need [mise](https://mise.jdx.dev) and a checkout of this repository.

```sh
mise install
mise run install
cp .env.example .env
mise run generate
```

`generate` writes the checked-in contracts and the ignored email template
modules. Edit `.env` and fill the empty values. Set `ENGINE_HMAC_KEYS_JSON` to
`{"web":"<ENGINE_HMAC_SECRET>"}` with the same secret you chose for
`ENGINE_HMAC_SECRET`. The [web configuration guide](docs/web-configuration.md)
says which values are required and how to generate each secret. Then create the
local database and start everything:

```sh
mise run dev:infra:setup
mise run dev
```

`dev` runs PostgreSQL, the engine, the web application and the maintenance
worker. It uses PostgreSQL on port 5432. The web application initializes the
current schema and seeds the database, then starts the Vite dev server on
<http://localhost:3000>.

The engine exits at startup because a clean checkout has no contacts database.
The other three processes keep running, and search and candidate assignment stay
unavailable until the engine is up.

### Contact data

The engine reads a SQLite contacts database that the pipeline builds. To run the
engine without the real data, build the database from the synthetic fixture in
[`crates/pipeline/data/fixture/`](crates/pipeline/data/fixture/). It holds a few
invented people and companies, so search returns a handful of results.

```sh
mise run pipeline:fixture          # writes crates/engine/data/contacts.sqlite
mise run dev:engine                # or restart `mise run dev`
```

The engine health endpoint needs no signature and reports the fixture's 11 rows:

```sh
curl http://127.0.0.1:3001/health
```

```text
{"status":"ok","build_id":"build-…","built_at":…,"rows":11}
```

The real data comes from the raw source snapshots listed in
[`source-manifest.json`](crates/pipeline/data/mappings/source-manifest.json).
The repository does not hold them. Ask a maintainer for the snapshots. With them
in [`crates/pipeline/data/raw/`](crates/pipeline/data/raw/) under the names in
the manifest, run `mise run pipeline:refresh:10k`, which samples 10,000 rows per
source. `--raw-dir` points the pipeline at another directory. The
[pipeline guide](crates/pipeline/readme.md#source-files) lists the other slices.

## What is here

| Path                                            | Contents                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| [`apps/web/`](apps/web/readme.md)               | SolidStart UI and HTTP routes, PostgreSQL state and the maintenance worker.     |
| [`apps/extension/`](apps/extension/readme.md)   | Browser extension that tracks call state and syncs it with the web application. |
| [`crates/engine/`](crates/engine/readme.md)     | Signed HTTP service for contact search, candidates and record imports.          |
| [`crates/pipeline/`](crates/pipeline/readme.md) | Builds and publishes the SQLite contacts database.                              |
| [`contracts/`](contracts/)                      | JSON contracts that generate and check the cross-package types.                 |
| [`packages/`](packages/)                        | Shared workspace packages.                                                      |
| [`ops/`](ops/)                                  | [Search benchmarks](ops/bench/readme.md) and deployment templates.              |

## Run one part

```sh
mise run dev:infra
mise run dev:engine
mise run dev:web
mise run dev:worker
```

The web application and the worker need PostgreSQL. Search and candidate
assignment also need the engine and a contacts database.

## Check your change

```sh
mise run check
```

The [contributing guide](.github/contributing.md) lists the focused checks.

## Deploy

[`compose.app.yml`](compose.app.yml) and
[`compose.engine.yml`](compose.engine.yml) deploy the application and the
engine. The [deployment guide](docs/deployment.md) describes both stacks and
their environment templates.

## Documentation

The [documentation index](docs/readme.md) lists every guide. Start with the
[architecture](docs/architecture.md).
