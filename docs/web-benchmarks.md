# Web benchmarks

The web application has CPU benchmarks under
[`apps/web/tests/bench/`](../apps/web/tests/bench/). Run them from `apps/web`:

```sh
bun run test:perf
```

The command runs `vitest bench` with
[`vitest.bench.config.ts`](../apps/web/vitest.bench.config.ts), which loads
`.env.test` and the CodSpeed plugin. For search benchmarks of the engine, see
[`ops/bench`](../ops/bench/readme.md).

Each directory under `tests/bench/` holds one domain, and each file in it
measures one layer. The file name prefix names the layer:

| File                   | Measures                                                      |
| ---------------------- | ------------------------------------------------------------- |
| `component*.bench.ts`  | Pure CPU helpers and domain logic, with no repo or DB access. |
| `boundary*.bench.ts`   | Parsing and validation only.                                  |
| `repository*.bench.ts` | Direct repository and query calls.                            |
| `command*.bench.ts`    | Application commands with prepared input.                     |
| `service*.bench.ts`    | End-to-end business flows and orchestration.                  |

A function appears in one benchmark unless the scenario differs. Parsing and
database work are separate benchmarks, so each can be measured alone.
