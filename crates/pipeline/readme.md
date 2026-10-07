# Pipeline

The pipeline turns source files into the SQLite contact database consumed by the
[engine](../engine/readme.md). It validates source mappings and contracts,
normalizes rows, merges accepted records into a staged database, materializes
engine projections, runs quality gates, and promotes a passing database.

The command entrypoint is [`src/main.rs`](src/main.rs). Argument parsing and
dispatch are in [`src/cli.rs`](src/cli.rs) and
[`src/pipeline.rs`](src/pipeline.rs). Runtime paths and profiles are defined in
[`pipeline.toml`](pipeline.toml).

## Data flow

```text
raw files -> manifest and mappings -> normalized rows -> staged SQLite
         -> engine projections -> quality gate -> published contacts.sqlite
```

The manifest is
[`data/mappings/source-manifest.json`](data/mappings/source-manifest.json).
Enabled entries name a raw file and a mapping. Raw files belong in
[`data/raw/`](data/raw/). Mappings belong in
[`data/mappings/sources/`](data/mappings/sources/). Canonical and projection
contracts are under [`../../contracts/`](../../contracts/).

The clean checkout does not include six external raw snapshots. Their enabled
manifest entries are marked `raw_optional`: `celulares`, `claro_post_202508`,
`consolidado_ruc_representantes_ok`, `representantes_enriquecido`, `osiptel`,
and `padron_ruc_202601`. The root `pipeline:verify-manifest` and
`pipeline:normalize-sample` scripts pass `--allow-missing-optional`, so they
verify mappings and skip absent optional inputs with a warning. Production
validation and direct Cargo commands remain strict and require every enabled raw
input.

Configuration and manifest handling live under [`src/config/`](src/config/).
Normalization is under [`src/normalize/`](src/normalize/), sharded ingestion is
under [`src/ingest/`](src/ingest/), and merge logic is under
[`src/merge/`](src/merge/). Run orchestration is under [`src/run/`](src/run/).
Serving-table creation is in [`src/materialize.rs`](src/materialize.rs),
validation is in [`src/validate.rs`](src/validate.rs), the quality gate is in
[`src/gate.rs`](src/gate.rs), and atomic replacement is in
[`src/promote.rs`](src/promote.rs).

## Commands

Run commands from the repository root with:

```sh
bun run pipeline:engine <command>
```

The direct Cargo form is:

```sh
cargo run -p pipeline -- <command>
```

Available commands and their defaults are:

```text
verify-manifest [--manifest <path>] [--allow-missing-optional]
validate [--config <path>] [--profile quick|standard|heavy|full] [--allow-missing-optional]
bench [--config <path>] [--profile quick|standard|heavy]
bench-map [--config <path>] [--profile quick|standard|heavy]
build [--config <path>] [--profile full]
promote [--config <path>] [--from <path>] [--to <path>]
refresh [--config <path>] [--slice 10k|100k|100k-osiptel] [--to <path>]
```

Useful local commands are:

```sh
bun run pipeline:verify-manifest
bun run pipeline:normalize-sample
bun run pipeline:refresh:10k
bun run pipeline:refresh:100k
bun run pipeline:engine validate --profile quick
bun run pipeline:engine validate --profile standard
```

`refresh` builds a sample profile and publishes it to the engine database. It
does not create the full production-size dataset. It requires the raw inputs
because it uses the strict production policy. Use `--release` for a long-running
build or promotion.

## Full rebuild and promotion

The full profile reads every enabled manifest source without a row cap. Run it
in a supervised shell with log capture:

```sh
make -C crates/pipeline verify
make -C crates/pipeline build-full
make -C crates/pipeline promote
```

`build-full` writes `data/build/staged/contacts.pipeline.staged.sqlite` and does
not replace the engine database. `promote` checks the staged database, writes
build metadata, copies it with `VACUUM INTO`, atomically replaces
`crates/engine/data/contacts.sqlite`, and keeps the previous database as
`contacts.sqlite.prev`.

The direct release commands are:

```sh
cargo run --release --manifest-path crates/pipeline/Cargo.toml -- verify-manifest
cargo run --release --manifest-path crates/pipeline/Cargo.toml -- build --profile full
cargo run --release --manifest-path crates/pipeline/Cargo.toml -- promote
```

Restart the engine after promotion. The engine opens the published file through
its read-only pool during startup.

## Outputs

The default paths in [`pipeline.toml`](pipeline.toml) are:

```toml
manifest = "crates/pipeline/data/mappings/source-manifest.json"
normalized_dir = "crates/pipeline/data/normalized"
staged_db = "crates/pipeline/data/build/staged/contacts.pipeline.staged.sqlite"
bench_dir = "crates/pipeline/data/build/bench"
engine_db = "crates/engine/data/contacts.sqlite"
```

Normalized diagnostics go to `data/normalized/`. Sample and benchmark outputs go
to `data/build/bench/`. Full staged output goes to `data/build/staged/`. Run
metadata and checkpoints live next to the target database under `runs/`.

## First reads

Start with [`src/pipeline.rs`](src/pipeline.rs), [`src/cli.rs`](src/cli.rs), and
[`src/config/runtime.rs`](src/config/runtime.rs). For a full build, read
[`src/run/full.rs`](src/run/full.rs) and [`src/run/phase.rs`](src/run/phase.rs).
For sample and benchmark runs, read [`src/run/matrix.rs`](src/run/matrix.rs).
