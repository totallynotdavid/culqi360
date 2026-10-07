# Documentation

This index is for contributors and operators working on Culqi360. The root
[README](../readme.md) covers what the repository contains and the shortest
local setup. This index points to the document that owns each deeper subject.

- [Architecture](architecture.md): component boundaries and code map.
- [Web application](../apps/web/readme.md): request handling, persistence,
  workers, and engine integration.
- [Web configuration](../apps/web/docs/configuration.md): environment values and
  deployment-facing integrations.
- [Database development](../apps/web/docs/database.md): disposable schema,
  initialization, reset, and seed commands.
- [End-to-end testing](../apps/web/docs/e2e-testing.md): Playwright setup,
  isolated databases, fixtures, and mail assertions.
- [Cookies](../apps/web/docs/cookies.md): choose the cookie API for request,
  header, and browser contexts.
- [Diagnostics](../apps/web/docs/diagnostics.md): enable SSR, hydration, and
  request tracing diagnostics.
- [Realtime](../apps/web/docs/realtime.md): server-sent event transport,
  reconnect behavior, and topic recovery.
- [Merchant statistics](../apps/web/docs/merchant-gpv.md): GPV imports,
  attribution, targets, and access rules.
- [User terminology](../apps/web/docs/glossary.md): the user-facing Spanish
  terms owned by the web product.
- [Engine](../crates/engine/readme.md): runtime, signed HTTP endpoints,
  configuration, and validation.
- [Pipeline](../crates/pipeline/readme.md): source mapping, builds, quality
  gates, and publication.
- [Browser extension](../apps/extension/readme.md): call state, handoff, and
  synchronization.
- [Search benchmarks](../ops/bench/readme.md): smoke and full benchmark modes.
- [Solid Motion](../packages/solid-motion/readme.md): the local Solid animation
  package and its public primitives.
