# Documentation

Guides for people who build and operate Culqi360. The [README](../readme.md)
covers setup. Each guide below owns one subject.

## Start here

- [Architecture](architecture.md): how the web application, engine, pipeline and
  extension fit together, and where the code is.
- [Contracts](contracts.md): the JSON contracts and the files generated from
  them.
- [Deployment](deployment.md): the application and engine Compose stacks.
- [Contributing](../.github/contributing.md): setup, checks and review.

## Web application

- [Web configuration](web-configuration.md): environment variables and which are
  required.
- [Database development](database.md): initialize, reset and change the
  disposable schema.
- [Preview](preview.md): an authenticated local session for checking the UI.
- [Action runtime](action-runtime.md): how a server action parses,
  authenticates, authorizes and reports errors.
- [Cookies](cookies.md): which cookie API to use in each context.
- [Realtime](realtime.md): server-sent events, reconnects and recovery.
- [Diagnostics](diagnostics.md): hydration and request tracing output.
- [End-to-end testing](e2e-testing.md): Playwright, isolated databases and
  fixtures.
- [Web benchmarks](web-benchmarks.md): CPU benchmarks for the web application.

## Product

- [Merchant statistics](merchant-stats.md): GPV imports, attribution, targets
  and access.
- [Terminology](terminology.md): the Spanish terms the interface uses.

## Other components

- [Engine](../crates/engine/readme.md): signed endpoints, configuration and
  startup.
- [Pipeline](../crates/pipeline/readme.md): source files, commands, rebuild and
  promotion.
- [Browser extension](../apps/extension/readme.md): call state, web handoff and
  sync.
- [Search benchmarks](../ops/bench/readme.md): smoke and full engine benchmarks.
- [Solid Motion](../packages/solid-motion/readme.md): the animation package.
