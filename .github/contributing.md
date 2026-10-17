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

It runs `lint`, `typecheck`, `test` and `build`, and writes no tracked file.
`lint` checks TypeScript, JSON, YAML and Markdown formatting with oxfmt, runs
oxlint, `cargo fmt` and clippy, checks the generated contracts and scans the
tree for secrets with gitleaks. `test` needs no services. CI runs
`mise run check` and, with PostgreSQL, `mise run test:integration`.

`mise run fix` applies the safe lint fixes and formats every file.

Focused checks:

| Area              | Command                                                               |
| ----------------- | --------------------------------------------------------------------- |
| TypeScript        | `mise run typecheck` (every package, see [`@crm/tsconfig`][tsconfig]) |
| Web               | `mise run lint:web`, `mise run test:ts`                               |
| Web with database | `mise run test:integration`                                           |
| Web benchmarks    | `mise run test:perf`                                                  |
| Web end-to-end    | `bun run --cwd apps/web test:e2e`                                     |
| Rust              | `mise run lint:rust`, `mise run test:rust`                            |
| Contracts         | `mise run lint:contracts`                                             |
| Formatting        | `mise run lint:format`                                                |
| Secrets           | `mise run lint:secrets`                                               |
| Browser extension | `mise run typecheck`, `mise run test:extension`                       |

[tsconfig]: ../packages/tsconfig/readme.md

The lint, typecheck, test, build and dev tasks generate the email templates
first. The [end-to-end guide](../docs/e2e-testing.md) covers the Playwright
suite and the [benchmark guide](../docs/web-benchmarks.md) the `test:perf`
suite.

The pipeline has more commands in [its README](../crates/pipeline/readme.md).

## Documentation

Each subsystem has one documentation owner. Component behavior lives in the
README next to the component. Cross-cutting guides live in
[`docs/`](../docs/readme.md), and every guide is listed in its index. When a
change alters documented behavior, update that document in the same pull request
and run every command you document.
