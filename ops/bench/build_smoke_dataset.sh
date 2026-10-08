#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BENCH_ROOT="${BENCH_ROOT:-/srv/crm/bench}"
RAW_SOURCE_DIR="${RAW_SOURCE_DIR:-/srv/crm/raw}"
DATASET_VERSION="${DATASET_VERSION:-$(date +%Y%m%d-%H%M%S)}"

SMOKE_DB_PATH="${SMOKE_DB_PATH:-$BENCH_ROOT/datasets/smoke/contacts.sqlite}"
SMOKE_MANIFEST_PATH="${SMOKE_MANIFEST_PATH:-$BENCH_ROOT/manifests/smoke.json}"
WORKLOAD_PATH="${WORKLOAD_PATH:-$BENCH_ROOT/workloads/smoke.json}"
DOC_PROJECTION_CONTRACT_PATH="${DOC_PROJECTION_CONTRACT_PATH:-$ROOT_DIR/contracts/engine/doc-projection.json}"
COMPANY_PROJECTION_CONTRACT_PATH="${COMPANY_PROJECTION_CONTRACT_PATH:-$ROOT_DIR/contracts/engine/company-projection.json}"
PIPELINE_BIN="${PIPELINE_BIN:-}"

if [[ ! -d "$RAW_SOURCE_DIR" ]]; then
  echo "raw source dir not found: $RAW_SOURCE_DIR" >&2
  exit 1
fi

echo "[bench] building smoke dataset at $SMOKE_DB_PATH"
mkdir -p "$(dirname "$SMOKE_DB_PATH")"
cd "$ROOT_DIR"
if [[ -n "$PIPELINE_BIN" ]]; then
  if [[ ! -x "$PIPELINE_BIN" ]]; then
    echo "pipeline binary is not executable: $PIPELINE_BIN" >&2
    exit 1
  fi
  "$PIPELINE_BIN" refresh --raw-dir "$RAW_SOURCE_DIR" --slice 100k --to "$SMOKE_DB_PATH"
else
  cargo run -p pipeline --release -- refresh --raw-dir "$RAW_SOURCE_DIR" --slice 100k --to "$SMOKE_DB_PATH"
fi

echo "[bench] generating smoke workload at $WORKLOAD_PATH"
python3 "$ROOT_DIR/ops/bench/generate_workload_from_db.py" \
  --db-path "$SMOKE_DB_PATH" \
  --output "$WORKLOAD_PATH"

echo "[bench] writing smoke dataset manifest"
python3 "$ROOT_DIR/ops/bench/update_manifest.py" \
  --db-path "$SMOKE_DB_PATH" \
  --dataset-id "search-smoke" \
  --dataset-version "$DATASET_VERSION" \
  --doc-projection-contract-path "$DOC_PROJECTION_CONTRACT_PATH" \
  --company-projection-contract-path "$COMPANY_PROJECTION_CONTRACT_PATH" \
  --workload-json-path "$WORKLOAD_PATH" \
  --output "$SMOKE_MANIFEST_PATH"
