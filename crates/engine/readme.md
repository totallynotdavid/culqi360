# Engine

The engine is the signed HTTP service behind contact search, candidate
selection, record imports and optional source-data ingestion. It reads the
published contacts SQLite database, keeps a writable leads database, and checks
both schemas at startup. The [web application](../../apps/web/readme.md) calls
it.

The engine does not build the contacts database. The
[pipeline](../pipeline/readme.md) builds and promotes it. The engine opens the
database at startup, so restart it after a promotion.

## Run

From the repository root:

```sh
bun run dev:engine
```

The engine exits at startup when `ENGINE_CONTACTS_DB_PATH` does not exist. A
clean checkout has no contacts database. `bun run pipeline:fixture` builds a
small one from synthetic data (see
[Pipeline](../pipeline/readme.md#source-files)). The engine also needs
`ENGINE_HMAC_KEYS_JSON`, which is in `.env.example`.

Check and test:

```sh
mise run check:rust
```

## Endpoints

| Endpoint                        | Purpose                                 |
| ------------------------------- | --------------------------------------- |
| `GET /health`                   | Probes the published database. No auth. |
| `POST /search`                  | Contact search.                         |
| `POST /records/candidates`      | Candidate selection.                    |
| `POST /records/imports`         | Record import.                          |
| `POST /ingest-uploads`          | Register an upload (ingest only).       |
| `PUT /ingest-uploads/{id}/blob` | Upload the file (ingest only).          |
| `GET /ingest-jobs/{job_id}`     | Read an ingest job (ingest only).       |
| `GET /ingest-sources`           | List source keys (ingest only).         |

`GET /health` returns `200` with `status: "ok"` and `rows` from the published
database, plus `build_id` and `built_at` when the database records them. It
returns `503` with `status: "degraded"` when the database probe fails.

Every other endpoint needs the headers `x-key-id`, `x-timestamp` and
`x-signature`. The signature is the lowercase hexadecimal HMAC-SHA256 of the
big-endian unsigned 64-bit timestamp followed by the raw request body. A `GET`
has an empty body. The blob `PUT` signs the upload id instead of the body.
Timestamps must be within `ENGINE_HMAC_MAX_SKEW_SECS` of the engine clock. A
token bucket limits each key per endpoint. It holds `ENGINE_RATE_LIMIT_PER_KEY`
tokens, refills at that many per minute, and each request spends the cost listed
below. Failed signatures draw from a separate bucket for the key id, or a shared
one for unknown key ids.

`POST /search` takes `intent` (`people`, `companies` or `mixed`), `query` and an
optional `limit`. The default limit is 20. The engine caps it at
`ENGINE_MAX_LIMIT`. The query shape selects the lookup and its cost:

| Query                                             | Lookup                  | Cost |
| ------------------------------------------------- | ----------------------- | ---- |
| `TYPE:NUMBER` (`DNI`, `CE`, `PTP`, `CSR`, `CIRE`) | Document                | 1    |
| 11 digits                                         | RUC                     | 1    |
| 8 digits                                          | DNI                     | 1    |
| 7 to 15 other digits                              | Phone                   | 1    |
| Text, `people` or `companies`                     | Name                    | 2    |
| Text, `mixed`                                     | Person and company name | 3    |

Text queries are 2 to 120 characters and need one term of three or more
alphanumeric characters. [`search/src/domain.rs`](../search/src/domain.rs) plans
the query.

`POST /records/candidates` takes branch and user IDs, an optional team and
product ID, an optional amount (default 20, capped at `ENGINE_MAX_LIMIT`) and a
`strategy` (`balanced`, `freshness` or `conversion`). It returns normalized
candidate rows. The cost is the requested amount divided by 10, rounded up.

`POST /records/imports` takes a `rows` array. Each row has `ruc`,
`organization_name`, `dni`, `person_name` and `phone_primary`. `quality_tier`,
`product_tag` and `branch_tag` are optional. The body is capped at 10 MiB. The
cost is the row count divided by 100, rounded up.

The request and response shapes come from the JSON contracts. See
[contracts](../../docs/contracts.md).

The ingest endpoints exist only when `ENGINE_INGEST_ENABLED=true`. The register
request declares the source key, snapshot label and date, byte size and
lowercase SHA-256. The blob is streamed to `uploads/` beside the contacts
database, hashed and queued for processing. Enabling ingest switches the
contacts database to WAL journal mode at startup, so no other process may hold a
lock on it. The engine clears the upload directory at startup and marks jobs
that a restart interrupted as failed. Job state lives in
`ENGINE_INGEST_JOB_DB_PATH` (default `crates/engine/data/ingest.sqlite`).

## Configuration

The engine loads the repository root `.env`. `ENGINE_HMAC_KEYS_JSON` is required
and must be a non-empty JSON object that maps key ids to secrets, such as
`{"web":"secret"}`. The web application signs with `ENGINE_HMAC_KEY_ID` and
`ENGINE_HMAC_SECRET`, so its key ID must be a key here with the same secret.
Defaults from [`src/config.rs`](src/config.rs):

| Variable                    | Default                              |
| --------------------------- | ------------------------------------ |
| `ENGINE_CONNECT_MODE`       | `local`                              |
| `ENGINE_CONTACTS_DB_PATH`   | `crates/engine/data/contacts.sqlite` |
| `ENGINE_LEADS_DB_PATH`      | `crates/engine/data/leads.sqlite`    |
| `ENGINE_HOST`               | `127.0.0.1`                          |
| `ENGINE_PORT`               | `3001`                               |
| `ENGINE_HMAC_MAX_SKEW_SECS` | `60`                                 |
| `ENGINE_RATE_LIMIT_PER_KEY` | `600`                                |
| `ENGINE_MAX_LIMIT`          | `100`                                |

The engine checks `ENGINE_CONNECT_MODE` in one place: `local` requires a
loopback `ENGINE_HOST`, and the other modes accept any host. The web application
validates `ENGINE_URL` against its own `ENGINE_CONNECT_MODE`: `local` needs
`http` and a loopback host, `internal` needs `http` and a non-loopback host, and
`remote` needs `https` and a non-loopback host.

With ingest enabled, the defaults are 4 workers, a batch size of 5,000, a 2 GiB
upload limit, a 10 million row limit and 8 queued uploads. Override them with
`ENGINE_INGEST_WORKERS`, `ENGINE_INGEST_BATCH_SIZE`,
`ENGINE_INGEST_MAX_UPLOAD_BYTES`, `ENGINE_INGEST_MAX_ROWS` and
`ENGINE_INGEST_MAX_QUEUED_UPLOADS`.

## Code map

- [`src/runtime.rs`](src/runtime.rs) loads configuration, validates the
  databases and mounts the routers.
- [`src/health.rs`](src/health.rs) probes the published database and reports
  build metadata.
- [`src/ingest/`](src/ingest/) holds streamed uploads and ingest jobs.
- [`../search/`](../search/) holds search queries and response contracts.
- [`../leads/`](../leads/) holds candidate selection and record imports.
- [`../shared/`](../shared/) holds HMAC, rate limiting, errors and SQLite
  helpers.
- [`../../ops/bench/readme.md`](../../ops/bench/readme.md) covers search
  benchmarks.
