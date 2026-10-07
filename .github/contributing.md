# Contributing

Contributors need `mise`, Bun, Rust, PostgreSQL, and the repository's pinned
tool versions. From the repository root:

```sh
mise install
bun install
cp .env.example .env
bun run generate
```

`generate` writes checked-in contracts and the ignored email template modules.
Fill the required local values in `.env` before running the web application. Use
the [repository README](../readme.md) for the shortest working setup and the
[documentation index](../docs/readme.md) for component guides.

## Checks

Run the smallest check that covers the change. Run the full check for changes
that cross package boundaries or change generated contracts:

```sh
bun run check
```

Focused commands are:

```sh
bun run --cwd apps/web check
bun run --cwd apps/web test
bun run check:engine
bun run test:engine
bun run test:extension:integration
bun run --cwd packages/solid-motion test
```

`apps/web check:types`, `apps/web lint`, and `apps/web check` generate email
templates before their compiler or linter step. The web Vitest projects and the
email-composer Vitest config generate them through shared global setup, so
`apps/web test` and the package test do not require generated files to exist
before the command starts.

Rust formatting and linting are included in `bun run check`. The pipeline has
additional commands in
[`crates/pipeline/readme.md`](../crates/pipeline/readme.md).

## Before review

Read the document that owns the subsystem you changed. Keep behavior changes and
documentation changes together when the documentation describes that behavior.
Check every new path and command locally, and report commands that need external
credentials or services as unverified.
