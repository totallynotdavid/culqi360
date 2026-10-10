# Contributing

## Set up

Follow [Get started](../readme.md#get-started) in the README. `mise install`
installs the pinned Rust, Bun and PostgreSQL versions from
[`mise.toml`](../mise.toml). The [documentation index](../docs/readme.md) lists
the guides for each component.

## Check your change

Run the smallest check that covers the change. Run the full check when a change
crosses package boundaries or changes a generated contract:

```sh
bun run check
```

It runs the Rust checks (`cargo xtask-check`, `xtask-fmt`, `xtask-clippy`), the
type check of every TypeScript package, the contract checks, the lint checks and
the TypeScript and Markdown format checks.

Focused checks:

| Area              | Command                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| TypeScript        | `bun run typecheck` (every package, see [`@crm/tsconfig`][tsconfig])           |
| Web               | `bun run check:lint`, `bun run test`                                           |
| Web benchmarks    | `bun run --cwd apps/web test:perf`                                             |
| Web end-to-end    | `bun run --cwd apps/web test:e2e`                                              |
| Engine            | `bun run check:engine`, `bun run test:engine`                                  |
| Contracts         | `bun run check:contracts`, `bun run check:search-contract`                     |
| Browser extension | `bun run --cwd apps/extension typecheck`, `bun run test:extension:integration` |

[tsconfig]: ../packages/tsconfig/readme.md

`typecheck` and `check:lint` generate the email templates first. The web Vitest
projects and the email-composer Vitest config generate them in global setup, so
the tests run without a prepared checkout. The
[end-to-end guide](../docs/e2e-testing.md) covers the Playwright suite and the
[benchmark guide](../docs/web-benchmarks.md) the `test:perf` suite.

Format TypeScript, Markdown and Rust with `bun run format`. The pipeline has
more commands in [its README](../crates/pipeline/readme.md).

## Documentation

Each subsystem has one documentation owner. Component behavior lives in the
README next to the component. Cross-cutting guides live in
[`docs/`](../docs/readme.md), and every guide is listed in its index. When a
change alters documented behavior, update that document in the same pull request
and run every command you document.
