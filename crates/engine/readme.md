# Engine

The engine is the signed HTTP service for contact search, candidate selection,
record imports, health checks, and optional source-data ingestion. It reads the
published contacts SQLite database, keeps a writable leads database, validates
both schemas at startup, and serves the routers assembled in
[`src/runtime.rs`](src/runtime.rs).

The engine does not build the contacts database. The
[pipeline](../pipeline/readme.md) builds and promotes it. Restart the engine
after promotion so new connections read the new file.

## Endpoints

The always-on endpoints are:

```text
GET  /health
POST /search
POST /records/candidates
POST /records/imports
```

Every `POST` request requires `x-key-id`, `x-timestamp`, and `x-signature`. The
signature is the lowercase hexadecimal HMAC-SHA256 of the big-endian unsigned
timestamp followed by the raw request body. Timestamps must be within
`ENGINE_HMAC_MAX_SKEW_SECS` of the engine clock. Authenticated requests are
rate-limited per key and endpoint.

`POST /search` accepts `intent` (`people`, `companies`, or `mixed`), `query`,
and an optional `limit`. The default limit is 20 and the configured maximum is
`ENGINE_MAX_LIMIT`.

`POST /records/candidates` accepts branch and user IDs, an optional team and
product ID, an optional amount (default 20), and `strategy` (`balanced`,
`freshness`, or `conversion`). Responses contain normalized candidate rows.

`POST /records/imports` accepts a `rows` array. Each row contains `ruc`,
`organization_name`, `dni`, `person_name`, and `phone_primary`; `quality_tier`,
`product_tag`, and `branch_tag` are optional. The request body is capped at 10
MiB.

Set `ENGINE_INGEST_ENABLED=true` to mount the additional signed endpoints:

```text
POST /ingest-uploads
PUT  /ingest-uploads/{upload_id}/blob
GET  /ingest-jobs/{job_id}
GET  /ingest-sources
```

The register request declares the source key, snapshot label and date, byte
size, and lowercase SHA-256. The blob is streamed to the engine-owned upload
directory, hashed, and queued for processing. The configured limits are in
`.env.example`.

## Configuration

The engine loads the repository root `.env`. `ENGINE_HMAC_KEYS_JSON` is required
and must be a non-empty JSON object such as `{"web":"secret"}`.

Defaults from [`src/config.rs`](src/config.rs) are:

```text
ENGINE_CONNECT_MODE=local
ENGINE_CONTACTS_DB_PATH=crates/engine/data/contacts.sqlite
ENGINE_LEADS_DB_PATH=crates/engine/data/leads.sqlite
ENGINE_HOST=127.0.0.1
ENGINE_PORT=3001
ENGINE_HMAC_MAX_SKEW_SECS=60
ENGINE_RATE_LIMIT_PER_KEY=600
ENGINE_MAX_LIMIT=100
```

Local mode requires a loopback `ENGINE_HOST`. Use `internal` for a private
container network and `remote` when the service is deliberately exposed behind
public network infrastructure.

When ingest is enabled, the defaults are 4 workers, a batch size of 5,000, a 2
GiB upload limit, a 10 million row limit, and 8 queued uploads. Override those
values with `ENGINE_INGEST_WORKERS`, `ENGINE_INGEST_BATCH_SIZE`,
`ENGINE_INGEST_MAX_UPLOAD_BYTES`, `ENGINE_INGEST_MAX_ROWS`, and
`ENGINE_INGEST_MAX_QUEUED_UPLOADS`.

## Run and validate

Build a sample contacts database, then start the engine from the repository
root:

```sh
bun run pipeline:refresh
bun run dev:engine
```

Run the engine checks and tests:

```sh
bun run check:engine
bun run test:engine
```

## Code map

- [`src/runtime.rs`](src/runtime.rs) loads configuration, validates databases,
  and mounts the routers.
- [`src/health.rs`](src/health.rs) probes the published database and reports
  build metadata.
- [`src/ingest/`](src/ingest/) owns optional streamed uploads and ingest jobs.
- [`../search/`](../search/) owns search queries and response contracts.
- [`../leads/`](../leads/) owns candidate selection and record imports.
- [`../shared/`](../shared/) owns HMAC, rate limiting, errors, and SQLite
  helpers.
- [`../../ops/bench/readme.md`](../../ops/bench/readme.md) owns benchmark
  operation.
