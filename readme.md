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
mise install                # Rust, Bun, PostgreSQL, uv, Python
bun install
cp .env.example .env
bun run generate
```

Edit `.env` and fill the empty values. The
[web configuration guide](docs/web-configuration.md) says which are required and
how to generate each secret. Then create the local database and start
everything:

```sh
bun run dev:infra:setup     # once per checkout
bun run dev
```

`dev` runs PostgreSQL, the engine, the web application and the maintenance
worker. The web application is at <http://localhost:3000>. Open it and it
redirects to `/login`.

The engine exits at startup because a clean checkout has no contacts database.
The other three processes keep running, and search and candidate assignment stay
unavailable until the engine is up.

### Contact data

The engine reads a SQLite contacts database that the pipeline builds. To run the
engine without the real data, build the database from the synthetic fixture in
[`crates/pipeline/data/fixture/`](crates/pipeline/data/fixture/). It holds a few
invented people and companies, so search returns a handful of results.

```sh
bun run pipeline:refresh:fixture   # writes crates/engine/data/contacts.sqlite
bun run dev:engine                 # or restart `bun run dev`
```

The real data comes from the raw source snapshots listed in
[`source-manifest.json`](crates/pipeline/data/mappings/source-manifest.json).
They are not in the repository, and the origin and retrieval command of the raw
snapshots are not recorded anywhere in it, so the maintainer must supply them.
With the snapshots in [`crates/pipeline/data/raw/`](crates/pipeline/data/raw/)
under the names in the manifest, run `bun run pipeline:refresh:10k`, which
samples 10,000 rows per source. The
[pipeline guide](crates/pipeline/readme.md#source-files) lists the other slices.

To check the setup:

```sh
bun run check:contracts
```

```text
all contracts are up to date
```

## What is here

| Path                                            | Contents                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`apps/web/`](apps/web/readme.md)               | SolidStart UI and HTTP routes, PostgreSQL state and the maintenance worker.           |
| [`apps/extension/`](apps/extension/readme.md)   | Browser extension that tracks call state and syncs it with the web application.       |
| [`crates/engine/`](crates/engine/readme.md)     | Signed HTTP service for contact search, candidates and record imports.                |
| [`crates/pipeline/`](crates/pipeline/readme.md) | Builds and publishes the SQLite contacts database.                                    |
| [`contracts/`](contracts/)                      | JSON contracts that generate and check the cross-package types.                       |
| [`packages/`](packages/)                        | Shared workspace packages, including [Solid Motion](packages/solid-motion/readme.md). |
| [`ops/`](ops/)                                  | [Search benchmarks](ops/bench/readme.md) and deployment templates.                    |

## Run one part

```sh
bun run dev:infra     # PostgreSQL
bun run dev:engine
bun run dev:web
bun run dev:worker
```

The web application and the worker need PostgreSQL. Search and candidate
assignment also need the engine and a contacts database.

## Check your change

```sh
bun run check
```

The [contributing guide](.github/contributing.md) lists the focused checks.

## Deploy

[`compose.app.yml`](compose.app.yml) and
[`compose.engine.yml`](compose.engine.yml) deploy the application and the
engine. Their environment templates are in [`ops/deployment/`](ops/deployment/).

## Documentation

The [documentation index](docs/readme.md) lists every guide. Start with the
[architecture](docs/architecture.md).
