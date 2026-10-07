# Search benchmarks

This directory owns the search benchmark runner and its dataset manifests. It
measures the engine's `bench-search` binary against a smoke dataset or an
existing full contacts database. It does not build the full production database.
The [pipeline](../../crates/pipeline/readme.md) owns that workflow.

## Runtime layout

The runner defaults to `/srv/crm/bench`:

```text
/srv/crm/bench/
├── datasets/smoke/contacts.sqlite
├── manifests/{smoke,full}.json
├── workloads/{smoke,full}.json
└── runs/<mode>-<run-id>.json
```

The checkout tracks only `ops/bench/baselines/.gitkeep`. It does not contain
`smoke.json` or `full.json`. For direct runs, `run_benchmark.sh` defaults
`BASELINE_PATH` to `ops/bench/baselines/{smoke,full}.json`, so create the
selected baseline there before a strict local gate or set `BASELINE_PATH` to an
existing host file.

The GitHub Actions workflow uses a different host path:
`/srv/crm/bench/baselines/<mode>.json`. A `gate` checks that this file already
exists. Run the same mode with `operation=bootstrap` first when it does not; the
workflow writes the new baseline at that path and uploads it as an artifact.
Runs are written under `/srv/crm/bench/runs` by default.

Full mode reads `/srv/crm/full/contacts.sqlite` unless `FULL_DB_PATH` or the
corresponding manifest variables override it. Full mode never runs a pipeline
build.

## Local scripts

`build_smoke_dataset.sh` rewrites the pipeline manifest for server paths,
refreshes the 100k sample, generates a workload, and writes a smoke manifest. It
requires raw source files under `/srv/crm/raw` by default. Override paths with
`BENCH_ROOT`, `RAW_SOURCE_DIR`, `SMOKE_DB_PATH`, and the other variables at the
top of the script.

`update_full_manifest.sh` generates a workload and manifest from an existing
full database. `run_benchmark.sh` runs `bench-search` in `smoke` or `full` mode.
It selects the manifest and workload from `BENCH_ROOT`, selects the repository
baseline unless `BASELINE_PATH` is set, writes the result to `OUTPUT_PATH` (or
`BENCH_ROOT/runs/<mode>-<run-id>.json`), and passes `--strict-baseline` when
`STRICT_BASELINE=1`. `promote_baseline.sh` replaces a baseline JSON file by
copying it through a temporary path and renaming it. The workflow supplies its
external `BASELINE_PATH` explicitly; the script's repository default applies
when the workflow is not supplying one.

The runner can use prebuilt binaries with `PIPELINE_BIN` and `BENCH_SEARCH_BIN`;
otherwise it invokes Cargo. Example:

```sh
MODE=smoke \
BENCH_ROOT=/srv/crm/bench \
BENCH_SEARCH_BIN=target/release/bench-search \
bash ops/bench/run_benchmark.sh
```

The command requires the selected manifest, workload, and baseline files. Set
`STRICT_BASELINE=1` to make the benchmark fail when the result does not meet the
baseline.

## GitHub Actions

The `bench search` workflow is manually dispatched on the self-hosted benchmark
runner. Its inputs are:

```text
mode=smoke|full
operation=gate|bootstrap
refresh_dataset=true|false
```

For a gate, the selected baseline must already exist at
`/srv/crm/bench/baselines/<mode>.json`. `bootstrap` writes a new baseline at
that path. Refreshing smoke mode rebuilds its sample dataset; refreshing full
mode updates metadata for the existing full database.
