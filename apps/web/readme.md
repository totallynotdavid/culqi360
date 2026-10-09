# Web application

The web application serves the Culqi360 UI and HTTP routes, stores CRM state in
PostgreSQL and runs the maintenance worker. It calls the
[engine](../../crates/engine/readme.md) for contact search, candidate
assignment, record imports and data-source ingestion.

## Run

The [root readme](../../readme.md#get-started) owns the setup and start
sequence. `bun run dev` serves the web server at <http://localhost:3000>. The
[database guide](../../docs/database.md) covers initialization, seed and reset.

To run the web server alone, use `bun run dev:web` and `bun run dev:worker`.
Both need PostgreSQL.

A production build is served by [`server.ts`](server.ts), a Bun adapter that
calls the generated SolidStart request handler. It listens on `PORT` (default
3000).

## Where things are

| Path                                                                             | Contents                                                |
| -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [`src/middleware.ts`](src/middleware.ts)                                         | Request context, security headers, session, navigation. |
| [`src/routes/`](src/routes/)                                                     | Authenticated, public and API routes.                   |
| [`src/rpc/`](src/rpc/)                                                           | RPC modules that validate input and call a capability.  |
| [`src/server/`](src/server/)                                                     | Capabilities, repositories and platform code.           |
| [`src/server/composition/application.ts`](src/server/composition/application.ts) | Runtime assembly.                                       |
| [`src/server/platform/database/`](src/server/platform/database/)                 | PostgreSQL access and schema.                           |
| [`src/server/integrations/engine/`](src/server/integrations/engine/)             | Engine client, request signing and ingest contracts.    |
| [`src/workers/maintenance-runner.ts`](src/workers/maintenance-runner.ts)         | Maintenance worker.                                     |
| [`src/browser/`](src/browser/)                                                   | Browser-only code, including the realtime client.       |

The [architecture guide](../../docs/architecture.md) describes how a request
moves through these layers.

## Guides

- [Configuration](../../docs/web-configuration.md)
- [Database development](../../docs/database.md)
- [Preview](../../docs/preview.md)
- [Action runtime](../../docs/action-runtime.md)
- [Cookies](../../docs/cookies.md)
- [Diagnostics](../../docs/diagnostics.md)
- [Realtime](../../docs/realtime.md)
- [End-to-end testing](../../docs/e2e-testing.md)
- [Benchmarks](../../docs/web-benchmarks.md)
- [Merchant statistics](../../docs/merchant-stats.md)
- [Terminology](../../docs/terminology.md)
