# Web benchmarks

The web application has CPU benchmarks under
[`apps/web/tests/bench/`](../apps/web/tests/bench/). Run them from `apps/web`:

```sh
mise run test:perf
```

The command loads `.env.test`, runs `vitest bench` once with
[`vitest.bench.config.ts`](../apps/web/vitest.bench.config.ts), and enables the
CodSpeed plugin. For search benchmarks of the engine, see
[`ops/bench`](../ops/bench/readme.md).

Each directory under `tests/bench/` holds one domain, and each file in it
measures one layer. The file name prefix names the layer:

| File                   | Measures                                                      |
| ---------------------- | ------------------------------------------------------------- |
| `component*.bench.ts`  | Pure CPU helpers and domain logic, with no repo or DB access. |
| `repository*.bench.ts` | Direct repository and query calls.                            |
| `command*.bench.ts`    | Application commands with prepared input.                     |
| `service*.bench.ts`    | End-to-end business flows and orchestration.                  |

`notifications-delivery` names its files by pipeline stage instead: `expand`,
`planner` and `dispatch`. `fixtures.ts` in each directory seeds the data, and
`_shared/` holds the database fixture and constants.

A function appears in one benchmark unless the scenario differs. Parsing and
database work are separate benchmarks, so each can be measured alone.
