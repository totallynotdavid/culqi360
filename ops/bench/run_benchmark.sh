#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BENCH_ROOT="${BENCH_ROOT:-/srv/crm/bench}"
MODE="${MODE:-smoke}"
RUN_ID="${RUN_ID:-$(date +%Y%m%d-%H%M%S)}"

if [[ "$MODE" != "smoke" && "$MODE" != "full" ]]; then
  echo "MODE must be smoke or full, got: $MODE" >&2
  exit 1
fi

MANIFEST_PATH="${MANIFEST_PATH:-$BENCH_ROOT/manifests/$MODE.json}"
WORKLOAD_PATH="${WORKLOAD_PATH:-$BENCH_ROOT/workloads/$MODE.json}"
# Timings belong to the host that measured them, so the baseline lives with the
# host's other benchmark state and is never committed.
BASELINE_PATH="${BASELINE_PATH:-$BENCH_ROOT/baselines/$MODE.json}"

OUTPUT_PATH="${OUTPUT_PATH:-$BENCH_ROOT/runs/${MODE}-${RUN_ID}.json}"
STRICT_BASELINE="${STRICT_BASELINE:-0}"
BENCH_SEARCH_BIN="${BENCH_SEARCH_BIN:-}"

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "manifest path not found: $MANIFEST_PATH" >&2
  exit 1
fi
if [[ ! -f "$WORKLOAD_PATH" ]]; then
  echo "workload path not found: $WORKLOAD_PATH" >&2
  exit 1
fi

if [[ "$STRICT_BASELINE" == "1" && ! -f "$BASELINE_PATH" ]]; then
  echo "baseline path not found: $BASELINE_PATH" >&2
  echo "run once with STRICT_BASELINE=0, then: bash ops/bench/promote_baseline.sh <report-json> $BASELINE_PATH" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"
cd "$ROOT_DIR"

if [[ -n "$BENCH_SEARCH_BIN" ]]; then
  if [[ ! -x "$BENCH_SEARCH_BIN" ]]; then
    echo "bench binary is not executable: $BENCH_SEARCH_BIN" >&2
    exit 1
  fi
  cmd=(
    "$BENCH_SEARCH_BIN"
    --mode "$MODE"
    --dataset-manifest-json "$MANIFEST_PATH"
    --workload-json "$WORKLOAD_PATH"
    --baseline-json "$BASELINE_PATH"
    --output-json "$OUTPUT_PATH"
  )
else
  cmd=(
    cargo run -p engine --bin bench-search --release --
    --mode "$MODE"
    --dataset-manifest-json "$MANIFEST_PATH"
    --workload-json "$WORKLOAD_PATH"
    --baseline-json "$BASELINE_PATH"
    --output-json "$OUTPUT_PATH"
  )
fi

if [[ "$STRICT_BASELINE" == "1" ]]; then
  cmd+=(--strict-baseline)
fi

"${cmd[@]}"
echo "$OUTPUT_PATH"
