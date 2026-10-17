# Contributing

## Set up

Follow [Get started](../readme.md#get-started) in the README. `mise install`
installs the pinned toolchain from [`mise.toml`](../mise.toml). The
[documentation index](../docs/readme.md) lists the guides for each component.

## Check your change

Run the smallest check that covers the change. Run the full check when a change
crosses package boundaries or changes a generated contract:

```sh
mise run check
```

It runs every linter and formatter in check mode, the type checks, the unit
tests, the web build and a secret scan of the git history. It needs no running
service and writes no tracked file. The web tests that use PostgreSQL run as
`mise run test:integration`, which CI runs in its own job; see
[Test databases](../docs/database.md#test-databases) for how they find a server.
`mise run fix` regenerates the generated files, applies the safe lint fixes and
runs oxfmt, rustfmt and ruff. [`.oxfmtrc.json`](../.oxfmtrc.json) lists the
paths oxfmt skips, and `fix` leaves those as they are.

Focused checks:

| Area              | Command                                                |
| ----------------- | ------------------------------------------------------ |
| TypeScript        | `mise run check:web` (see [`@crm/tsconfig`][tsconfig]) |
| Rust              | `mise run check:rust`                                  |
| Contracts         | `mise run check:contracts`                             |
| Python scripts    | `mise run check:python`                                |
| Formatting        | `mise run lint:format`                                 |
| Web benchmarks    | `mise run test:perf`                                   |
| Web end-to-end    | `mise run test:e2e`                                    |
| Browser extension | `mise run test:extension`                              |

[tsconfig]: ../packages/tsconfig/readme.md

`mise tasks` lists every task. `lint:ts` and `typecheck:ts` generate the email
templates first. The web Vitest projects and the email-composer Vitest config
generate them in global setup, so the tests run without a prepared checkout. The
[end-to-end guide](../docs/e2e-testing.md) covers the Playwright suite and the
[benchmark guide](../docs/web-benchmarks.md) the `test:perf` suite.

The pipeline has more commands in [its README](../crates/pipeline/readme.md).

## Documentation

Each subsystem has one documentation owner. Component behavior lives in the
README next to the component. Cross-cutting guides live in
[`docs/`](../docs/readme.md), and every guide is listed in its index. When a
change alters documented behavior, update that document in the same pull request
and run every command you document.
