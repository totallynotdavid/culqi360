# Pipeline

The pipeline turns source files into the SQLite contacts database that the
[engine](../engine/readme.md) serves. It validates source mappings and
contracts, normalizes rows, merges accepted records into a staged database,
materializes the engine projections, runs the quality gate and promotes a
passing database.

```text
raw files -> manifest and mappings -> normalized rows -> staged SQLite
         -> engine projections -> quality gate -> published contacts.sqlite
```

## Source files

The manifest is
[`data/mappings/source-manifest.json`](data/mappings/source-manifest.json). Each
enabled entry names a raw file (`raw_file`) and a mapping. The raw directory
resolves the file names. It is `raw_dir` in the config, by default
[`data/raw/`](data/raw/), and `--raw-dir <path>` replaces it for any command
that reads raw files. Mappings go in
[`data/mappings/sources/`](data/mappings/sources/). Canonical and projection
contracts are in [`../../contracts/`](../../contracts/).

A clean checkout has no raw files. Six enabled entries are marked `raw_optional`
because their snapshots live outside the repository: `celulares`,
`claro_post_202508`, `consolidado_ruc_representantes_ok`,
`representantes_enriquecido`, `osiptel` and `padron_ruc_202601`.

- `bun run pipeline:verify-manifest` and `bun run pipeline:normalize-sample`
  pass `--allow-missing-optional`. They check the mappings and skip absent
  optional inputs with a warning. Both run on a clean checkout.
  `verify-manifest` prints one JSON line, an array with a result per source.
- `refresh`, `build` and direct Cargo commands are strict. They need every
  enabled raw input.
- `bun run pipeline:fixture` runs `refresh --slice 10k` with
  [`data/fixture/pipeline.toml`](data/fixture/pipeline.toml), whose `raw_dir` is
  the synthetic files in [`data/fixture/raw/`](data/fixture/raw/). It needs no
  real data and promotes a small database to
  `crates/engine/data/contacts.sqlite`.

## Commands

Run commands from the repository root:

```sh
bun run pipeline:engine <command>
```

This is `cargo run -p pipeline -- <command>`. The commands and their defaults:

| Command           | Options (default first)                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| `verify-manifest` | `--manifest <path>`, `--raw-dir <path>`, `--allow-missing-optional`                                               |
| `validate`        | `--config <path>`, `--raw-dir <path>`, `--profile quick`\|`standard`\|`heavy`\|`full`, `--allow-missing-optional` |
| `bench`           | `--config <path>`, `--raw-dir <path>`, `--profile standard`\|`quick`\|`heavy`                                     |
| `bench-map`       | `--config <path>`, `--raw-dir <path>`, `--profile standard`\|`quick`\|`heavy`                                     |
| `build`           | `--config <path>`, `--raw-dir <path>`, `--profile full`                                                           |
| `promote`         | `--config <path>`, `--from <path>`, `--to <path>`                                                                 |
| `refresh`         | `--config <path>`, `--raw-dir <path>`, `--slice 100k`\|`10k`\|`100k-osiptel`, `--to <path>`                       |

`validate` defaults to the `quick` profile. A `refresh` slice selects a profile
from [`pipeline.toml`](pipeline.toml):

| Slice          | Profile    | Rows per source | Includes OSIPTEL |
| -------------- | ---------- | --------------- | ---------------- |
| `10k`          | `quick`    | 10,000          | No               |
| `100k`         | `standard` | 100,000         | No               |
| `100k-osiptel` | `heavy`    | 100,000         | Yes              |

`refresh` builds a sample profile and publishes it to the engine database. It
does not create the full production-size dataset. Shortcuts:

```sh
bun run pipeline:refresh
bun run pipeline:refresh:10k
bun run pipeline:refresh:100k
bun run pipeline:engine validate --profile standard
```

## Full rebuild and promotion

The `full` profile reads every enabled manifest source without a row cap. It
runs for a long time, so use a supervised shell with log capture. The
[`Makefile`](Makefile) wraps the release commands:

```sh
make -C crates/pipeline verify
make -C crates/pipeline build-full
make -C crates/pipeline promote
```

`build-full` writes `data/build/staged/contacts.pipeline.staged.sqlite` and
leaves the engine database alone. `promote` checks the staged database, writes
build metadata, copies it with `VACUUM INTO`, atomically replaces
`crates/engine/data/contacts.sqlite` and keeps the previous database as
`contacts.sqlite.prev`. Restart the engine afterwards.

Other Makefile targets:

| Target                                          | Runs                                                       |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `refresh-dev`, `refresh-dev-10k`                | `refresh --slice 100k` and `--slice 10k`, in release mode. |
| `validate-quick`, `validate-standard`           | `validate` with that profile.                              |
| `bench-quick`, `bench-standard`, `bench-heavy`  | `bench` with that profile.                                 |
| `capture-run RUN_ID=<id>`                       | Copies `data/normalized/` to `data/pipeline/runs/<id>/`.   |
| `generate-triage RUN_ID=<id>`                   | Writes a triage template for a captured run (needs `uv`).  |
| `compare-runs BASE_RUN=<id> CANDIDATE_RUN=<id>` | Writes a diff of two captured runs (needs `uv`).           |

## Outputs

Default paths from [`pipeline.toml`](pipeline.toml):

```toml
manifest = "crates/pipeline/data/mappings/source-manifest.json"
raw_dir = "crates/pipeline/data/raw"
normalized_dir = "crates/pipeline/data/normalized"
staged_db = "crates/pipeline/data/build/staged/contacts.pipeline.staged.sqlite"
bench_dir = "crates/pipeline/data/build/bench"
engine_db = "crates/engine/data/contacts.sqlite"
```

Normalized diagnostics go to `data/normalized/`. Sample and benchmark outputs go
to `data/build/bench/`. Full staged output goes to `data/build/staged/`. Run
metadata and checkpoints are in `runs/` next to the target database.

## Code map

- [`src/main.rs`](src/main.rs), [`src/cli.rs`](src/cli.rs) and
  [`src/pipeline.rs`](src/pipeline.rs) hold the entrypoint, argument parsing and
  command dispatch.
- [`src/config/`](src/config/) holds configuration and manifest handling.
- [`src/normalize/`](src/normalize/), [`src/ingest/`](src/ingest/) and
  [`src/merge/`](src/merge/) hold normalization, sharded ingestion and merging.
- [`src/run/`](src/run/) orchestrates runs: `full.rs` and `phase.rs` for a full
  build, `matrix.rs` for sample and benchmark runs.
- [`src/materialize.rs`](src/materialize.rs) creates the serving tables.
  [`src/validate.rs`](src/validate.rs), [`src/gate.rs`](src/gate.rs) and
  [`src/promote.rs`](src/promote.rs) validate, gate and atomically replace the
  database.
