#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
from pathlib import Path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def query_scalar(db_path: Path, sql: str) -> int:
    conn = sqlite3.connect(str(db_path))
    try:
        row = conn.execute(sql).fetchone()
        return int(row[0]) if row else 0
    finally:
        conn.close()


def query_pipeline_build(db_path: Path) -> dict[str, str]:
    conn = sqlite3.connect(str(db_path))
    try:
        try:
            rows = conn.execute("SELECT key, value FROM _pipeline_build").fetchall()
        except sqlite3.OperationalError:
            return {}
        return {str(k): str(v) for k, v in rows}
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate benchmark dataset manifest")
    parser.add_argument("--db-path", required=True)
    parser.add_argument("--dataset-id", required=True)
    parser.add_argument("--dataset-version", required=True)
    parser.add_argument("--doc-projection-contract-path", required=True)
    parser.add_argument("--company-projection-contract-path", required=True)
    parser.add_argument("--workload-json-path", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    db_path = Path(args.db_path)
    doc_contract_path = Path(args.doc_projection_contract_path)
    company_contract_path = Path(args.company_projection_contract_path)
    workload_path = Path(args.workload_json_path)
    output_path = Path(args.output)

    if not db_path.exists():
        raise SystemExit(f"db path does not exist: {db_path}")
    if not doc_contract_path.exists():
        raise SystemExit(
            f"doc projection contract path does not exist: {doc_contract_path}"
        )
    if not company_contract_path.exists():
        raise SystemExit(
            f"company projection contract path does not exist: {company_contract_path}"
        )
    if not workload_path.exists():
        raise SystemExit(f"workload json path does not exist: {workload_path}")

    projection_rows = query_scalar(db_path, "SELECT COUNT(*) FROM company_projection")
    payload = {
        "dataset_id": args.dataset_id,
        "dataset_version": args.dataset_version,
        "db_path": str(db_path),
        "doc_projection_contract_sha256": sha256_file(doc_contract_path),
        "company_projection_contract_sha256": sha256_file(company_contract_path),
        "workload_sha256": sha256_file(workload_path),
        "projection_rows": projection_rows,
        "pipeline_build": query_pipeline_build(db_path),
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(
        json.dumps({"manifest": str(output_path), "projection_rows": projection_rows})
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
