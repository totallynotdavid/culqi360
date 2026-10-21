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
mise run check
```

It runs the Rust checks (`cargo xtask-check`, `xtask-fmt`, `xtask-clippy`), the
type check of every TypeScript package and the Python scripts, the contract
checks, the lint checks and the TypeScript and Markdown format checks. CI also
scans the full git history for committed secrets with gitleaks.

Focused checks:

| Area              | Command                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| TypeScript        | `mise run typecheck` (every package, see [`@crm/tsconfig`][tsconfig])          |
| Web               | `mise run lint`, `mise run test`                                               |
| Web benchmarks    | `mise run test:perf`                                                           |
| Web end-to-end    | `bun run --cwd apps/web test:e2e`                                              |
| Engine            | `mise run lint:rust`, `mise run test`                                          |
| Python scripts    | `mise run lint:python`, `mise run typecheck:python`                            |
| Contracts         | `mise run lint:contracts`                                                      |
| Browser extension | `bun run --cwd apps/extension typecheck`, `bun run test:extension:integration` |

[tsconfig]: ../packages/tsconfig/readme.md

`typecheck` and `check:lint` generate the email templates first. The web Vitest
projects and the email-composer Vitest config generate them in global setup, so
the tests run without a prepared checkout. The
[end-to-end guide](../docs/e2e-testing.md) covers the Playwright suite and the
[benchmark guide](../docs/web-benchmarks.md) the `test:perf` suite.

Format TypeScript, Markdown and Rust with `mise run fix`. The pipeline has more
commands in [its README](../crates/pipeline/readme.md).

## Documentation

Each subsystem has one documentation owner. Component behavior lives in the
README next to the component. Cross-cutting guides live in
[`docs/`](../docs/readme.md), and every guide is listed in its index. When a
change alters documented behavior, update that document in the same pull request
and run every command you document.
