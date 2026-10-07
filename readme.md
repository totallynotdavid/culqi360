# Culqi360

Culqi360 is Infinity's internal sales CRM for sales teams and the services that
support their workflows. The repository contains the web application, a
contact-data pipeline, a search and records engine, and a browser extension for
call work. The web application owns CRM state in PostgreSQL. The engine owns
read-only contact search data and engine-local records. The pipeline publishes
that search data.

## Get started

Install the pinned toolchain and workspace dependencies:

```sh
mise install
bun install
cp .env.example .env
```

Fill the required values in `.env`. Then generate the checked-in contracts and
email templates, initialize PostgreSQL, and start the local services:

```sh
bun run generate
bun run dev:infra:setup
bun run dev
```

`dev:infra:setup` is a one-time setup for a new checkout. `dev` starts
PostgreSQL, the engine, the web application, and the maintenance worker. The web
process creates and seeds the development schema. The
[web configuration guide](apps/web/docs/configuration.md) describes the
environment values.

The smallest useful check after setup is:

```sh
bun run check:contracts
```

It should print `all contracts are up to date`. Use the
[documentation index](docs/readme.md) for component guides and operational
procedures before running a larger workflow.

## What is here

- [`apps/web/`](apps/web/) serves the UI and HTTP routes, owns PostgreSQL-backed
  CRM state, and runs the maintenance worker.
- [`crates/pipeline/`](crates/pipeline/) validates source files and publishes
  SQLite contact datasets.
- [`crates/engine/`](crates/engine/) serves signed search, candidate, import,
  health, and optional ingest endpoints.
- [`apps/extension/`](apps/extension/) tracks browser call state, recording
  payloads, and synchronization jobs.
- [`contracts/`](contracts/) holds the JSON contracts used to generate and check
  cross-package bindings.

The [architecture guide](docs/architecture.md) shows the boundaries between
these parts. The [documentation index](docs/readme.md) is the starting point for
component guides and operational procedures.

## Run one component

From the repository root:

```sh
bun run dev:infra
bun run dev:engine
bun run dev:web
bun run dev:worker
```

The web application requires PostgreSQL. Search and candidate assignment also
require a published contacts database and the engine.

## Validate changes

Run the repository checks before sending a cross-package change for review:

```sh
bun run check
```

The web typecheck and lint commands generate email templates through the root
`generate:templates` script. The web Vitest projects generate the same templates
through shared global setup, so tests do not require a prepared generated-file
directory.

Run focused tests from the package that owns the change. The
[contributing guide](.github/contributing.md) lists the available checks and the
expected review path.

## Deployments

The application and engine compose files are
[`compose.app.yml`](compose.app.yml) and
[`compose.engine.yml`](compose.engine.yml). Their environment templates are in
[`ops/deployment/`](ops/deployment/). The pipeline owns contact-dataset
publication; see its [pipeline guide](crates/pipeline/readme.md) before running
a full rebuild.
