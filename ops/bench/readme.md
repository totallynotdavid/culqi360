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
├── baselines/{smoke,full}.json
└── runs/<mode>-<run-id>.json
```

Baselines are timings from one host, so they live under `BENCH_ROOT` and are not
committed. `run_benchmark.sh` defaults `BASELINE_PATH` to
`$BENCH_ROOT/baselines/<mode>.json`. Without that file the benchmark runs,
prints a warning and compares nothing. With `STRICT_BASELINE=1` it fails and
prints the command that creates the baseline. To create one, run the benchmark
once and promote its report:

```sh
bash ops/bench/promote_baseline.sh <report.json> /srv/crm/bench/baselines/smoke.json
```

Runs are written under `/srv/crm/bench/runs` by default.

Full mode reads `/srv/crm/full/contacts.sqlite` unless `FULL_DB_PATH` or the
corresponding manifest variables override it. Full mode never runs a pipeline
build.

## Local scripts

`build_smoke_dataset.sh` runs the pipeline's `refresh --slice 100k` with
`--raw-dir "$RAW_SOURCE_DIR"`, generates a workload, and writes a smoke
manifest. It requires the raw source files in `/srv/crm/raw` by default.
Override paths with `BENCH_ROOT`, `RAW_SOURCE_DIR`, `SMOKE_DB_PATH`, and the
other variables at the top of the script.

`update_full_manifest.sh` generates a workload and manifest from an existing
full database. `run_benchmark.sh` runs `bench-search` in `smoke` or `full` mode.
It selects the manifest, workload and baseline from `BENCH_ROOT` unless
`MANIFEST_PATH`, `WORKLOAD_PATH` or `BASELINE_PATH` is set, writes the result to
`OUTPUT_PATH` (or `BENCH_ROOT/runs/<mode>-<run-id>.json`), and passes
`--strict-baseline` when `STRICT_BASELINE=1`. `promote_baseline.sh` replaces a
baseline JSON file by copying it through a temporary path and renaming it.

The runner can use prebuilt binaries with `PIPELINE_BIN` and `BENCH_SEARCH_BIN`;
otherwise it invokes Cargo. Example:

```sh
MODE=smoke \
BENCH_ROOT=/srv/crm/bench \
BENCH_SEARCH_BIN=target/release/bench-search \
bash ops/bench/run_benchmark.sh
```

The command requires the selected manifest and workload files. Set
`STRICT_BASELINE=1` to make the benchmark fail when no baseline exists. A run
that regresses against an existing baseline fails either way.

This benchmark has no GitHub Actions workflow. Run it locally on a host with the
datasets and baselines described above.
