#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


def fetch_values(conn: sqlite3.Connection, sql: str, limit: int) -> list[str]:
    rows = conn.execute(sql, {"limit": limit}).fetchall()
    values: list[str] = []
    seen: set[str] = set()
    for (raw,) in rows:
        value = str(raw).strip()
        if not value or value in seen:
            continue
        seen.add(value)
        values.append(value)
    return values


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate benchmark workload from SQLite dataset"
    )
    parser.add_argument("--db-path", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--limit", type=int, default=6)
    args = parser.parse_args()

    db_path = Path(args.db_path)
    output_path = Path(args.output)

    if not db_path.exists():
        raise SystemExit(f"db path does not exist: {db_path}")
    if args.limit <= 0:
        raise SystemExit("limit must be greater than zero")

    conn = sqlite3.connect(str(db_path))
    try:
        dni = fetch_values(
            conn,
            """
            SELECT doc_number
            FROM doc_projection
            WHERE doc_type = 'DNI'
              AND doc_number GLOB '[0-9]*'
              AND length(doc_number) = 8
            GROUP BY doc_number
            ORDER BY COUNT(*) DESC
            LIMIT :limit
            """,
            args.limit,
        )
        ruc = fetch_values(
            conn,
            """
            SELECT ruc
            FROM company_projection
            WHERE ruc GLOB '[0-9]*'
              AND length(ruc) = 11
            GROUP BY ruc
            ORDER BY COUNT(*) DESC
            LIMIT :limit
            """,
            args.limit,
        )
        phone = fetch_values(
            conn,
            """
            SELECT phone
            FROM (
                SELECT phone FROM doc_projection_phone_index
                UNION ALL
                SELECT phone FROM company_projection_phone_index
            )
            WHERE phone IS NOT NULL
              AND phone GLOB '[0-9]*'
              AND length(phone) BETWEEN 7 AND 15
            GROUP BY phone
            ORDER BY COUNT(*) DESC
            LIMIT :limit
            """,
            args.limit,
        )
        person_name = fetch_values(
            conn,
            """
            SELECT lower(substr(name, 1, instr(name || ' ', ' ') - 1)) AS token
            FROM doc_projection
            WHERE name IS NOT NULL
              AND trim(name) <> ''
            GROUP BY token
            HAVING length(token) >= 2
            ORDER BY COUNT(*) DESC
            LIMIT :limit
            """,
            args.limit,
        )
        company_name = fetch_values(
            conn,
            """
            SELECT lower(substr(legal_name, 1, instr(legal_name || ' ', ' ') - 1)) AS token
            FROM company_projection
            WHERE legal_name IS NOT NULL
              AND trim(legal_name) <> ''
            GROUP BY token
            HAVING length(token) >= 2
            ORDER BY COUNT(*) DESC
            LIMIT :limit
            """,
            args.limit,
        )
    finally:
        conn.close()

    payload = {
        "dni": dni,
        "ruc": ruc,
        "phone": phone,
        "phone_enriched": phone,
        "person_name": person_name,
        "company_name": company_name,
    }

    for key, values in payload.items():
        if not values:
            raise SystemExit(f"could not generate non-empty workload list for '{key}'")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "output": str(output_path),
                "counts": {k: len(v) for k, v in payload.items()},
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
