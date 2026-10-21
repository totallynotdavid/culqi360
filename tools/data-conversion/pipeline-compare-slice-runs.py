#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path
from typing import TypedDict

SUMMARY_FIELDS = [
    "total_rows",
    "normalized_rows",
    "error_rows",
    "invalid_dni_rows",
    "invalid_ruc_rows",
    "invalid_phone_rows",
    "empty_payload_rows",
    "mobile_phone_rows",
    "fixed_phone_rows",
]


def error_counts(errors_csv: Path) -> dict[str, int]:
    counts: Counter[str] = Counter()
    if not errors_csv.exists():
        return {}

    with errors_csv.open("r", encoding="utf-8", errors="replace", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            code_field = (row.get("error_code") or "").strip()
            if not code_field:
                continue
            for code in code_field.split(";"):
                normalized = code.strip()
                if normalized:
                    counts[normalized] += 1

    return dict(sorted(counts.items()))


class RunSummary(TypedDict):
    summary: dict[str, object]
    error_counts: dict[str, int]


def load_summaries(run_dir: Path) -> dict[tuple[str, str], RunSummary]:
    items: dict[tuple[str, str], RunSummary] = {}
    for summary_path in sorted(run_dir.glob("*/*/summary.json")):
        source_key = summary_path.parent.parent.name
        snapshot_label = summary_path.parent.name
        summary: dict[str, object] = json.loads(
            summary_path.read_text(encoding="utf-8")
        )
        errors = error_counts(summary_path.parent / "errors.csv")
        items[(source_key, snapshot_label)] = {
            "summary": summary,
            "error_counts": errors,
        }
    return items


def value_as_int(record: dict[str, object], key: str) -> int:
    raw = record.get(key, 0)
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float):
        return int(raw)
    if isinstance(raw, str) and raw.strip().isdigit():
        return int(raw.strip())
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compare two frozen slice-validation runs and emit metric deltas."
    )
    parser.add_argument("--base", required=True)
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    base_dir = Path(args.base)
    candidate_dir = Path(args.candidate)
    out_path = Path(args.out)

    if not base_dir.exists():
        raise SystemExit(f"base run does not exist: {base_dir}")
    if not candidate_dir.exists():
        raise SystemExit(f"candidate run does not exist: {candidate_dir}")

    base_data = load_summaries(base_dir)
    candidate_data = load_summaries(candidate_dir)
    all_keys = sorted(set(base_data.keys()) | set(candidate_data.keys()))

    source_diffs: list[dict[str, object]] = []
    for key in all_keys:
        source_key, snapshot_label = key
        base_item = base_data.get(key)
        candidate_item = candidate_data.get(key)

        base_summary = base_item["summary"] if base_item else {}
        cand_summary = candidate_item["summary"] if candidate_item else {}
        base_errors = base_item["error_counts"] if base_item else {}
        cand_errors = candidate_item["error_counts"] if candidate_item else {}

        summary_delta = {}
        for field in SUMMARY_FIELDS:
            base_val = value_as_int(base_summary, field)
            cand_val = value_as_int(cand_summary, field)
            summary_delta[field] = {
                "base": base_val,
                "candidate": cand_val,
                "delta": cand_val - base_val,
            }

        all_error_codes = sorted(set(base_errors.keys()) | set(cand_errors.keys()))
        error_delta = {}
        for code in all_error_codes:
            base_val = int(base_errors.get(code, 0))
            cand_val = int(cand_errors.get(code, 0))
            error_delta[code] = {
                "base": base_val,
                "candidate": cand_val,
                "delta": cand_val - base_val,
            }

        source_diffs.append(
            {
                "source_key": source_key,
                "snapshot_label": snapshot_label,
                "present_in_base": base_item is not None,
                "present_in_candidate": candidate_item is not None,
                "summary_delta": summary_delta,
                "error_code_delta": error_delta,
            }
        )

    report = {
        "base_run": str(base_dir),
        "candidate_run": str(candidate_dir),
        "sources_compared": len(source_diffs),
        "source_diffs": source_diffs,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"sources_compared": len(source_diffs), "out": str(out_path)}))


if __name__ == "__main__":
    main()
