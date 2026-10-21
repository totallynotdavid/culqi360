#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path


def collect_error_counts(errors_csv: Path) -> dict[str, int]:
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


def load_summary(summary_path: Path) -> dict[str, object]:
    summary: dict[str, object] = json.loads(summary_path.read_text(encoding="utf-8"))
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate manual triage template from a frozen slice-validation run."
    )
    parser.add_argument("--run-dir", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    run_dir = Path(args.run_dir)
    out_path = Path(args.out)
    if not run_dir.exists():
        raise SystemExit(f"run directory does not exist: {run_dir}")

    source_entries: list[dict[str, object]] = []
    summary_files = sorted(run_dir.glob("*/*/summary.json"))
    for summary_path in summary_files:
        source_key = summary_path.parent.parent.name
        snapshot_label = summary_path.parent.name
        errors_path = summary_path.parent / "errors.csv"

        summary = load_summary(summary_path)
        error_counts = collect_error_counts(errors_path)

        decisions = []
        for code, count in error_counts.items():
            decisions.append(
                {
                    "error_code": code,
                    "count": count,
                    "decision": "TBD",
                    "recoverability": "TBD",
                    "action": "TBD",
                    "notes": "",
                }
            )

        source_entries.append(
            {
                "source_key": source_key,
                "snapshot_label": snapshot_label,
                "summary": summary,
                "error_code_counts": error_counts,
                "triage_decisions": decisions,
                "approved_for_rule_changes": False,
            }
        )

    template = {
        "run_dir": str(run_dir),
        "status": "manual_triage_required",
        "ruleset_version": "pending",
        "sources": source_entries,
        "global_signoff": {
            "reviewed_by": "",
            "review_date": "",
            "approved_for_next_stage": False,
            "notes": "",
        },
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(template, indent=2), encoding="utf-8")
    print(json.dumps({"sources": len(source_entries), "out": str(out_path)}))


if __name__ == "__main__":
    main()
