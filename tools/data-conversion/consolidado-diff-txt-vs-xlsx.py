#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
import sqlite3
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
DIGIT_RE = re.compile(r"\D+")


def normalize_digits(value: str) -> str:
    digits = DIGIT_RE.sub("", value or "")
    return digits.lstrip("0") or ("0" if digits else "")


def normalize_phone_token(value: str) -> str:
    digits = normalize_digits(value)
    if digits.startswith("51") and len(digits) >= 9:
        digits = digits[2:]
    return digits


def normalize_doc_type(value: str) -> str:
    return (value or "").strip().upper()


def build_key(parts: list[str]) -> str:
    return "|".join(parts)


def upsert_count(
    conn: sqlite3.Connection,
    key: str,
    side: str,
    sample: str,
) -> None:
    if side == "txt":
        conn.execute(
            """
            INSERT INTO key_counts(key, txt_count, xlsx_count, sample_txt, sample_xlsx)
            VALUES(?1, 1, 0, ?2, NULL)
            ON CONFLICT(key) DO UPDATE SET
                txt_count = txt_count + 1,
                sample_txt = COALESCE(sample_txt, excluded.sample_txt)
            """,
            (key, sample),
        )
        return

    conn.execute(
        """
        INSERT INTO key_counts(key, txt_count, xlsx_count, sample_txt, sample_xlsx)
        VALUES(?1, 0, 1, NULL, ?2)
        ON CONFLICT(key) DO UPDATE SET
            xlsx_count = xlsx_count + 1,
            sample_xlsx = COALESCE(sample_xlsx, excluded.sample_xlsx)
        """,
        (key, sample),
    )


def collect_needed_shared_indexes(xlsx_path: Path) -> set[int]:
    needed: set[int] = set()
    with ZipFile(xlsx_path) as zf, zf.open("xl/worksheets/sheet1.xml") as fh:
        context = ET.iterparse(fh, events=("start", "end"))
        row_number = 0
        current_row = False

        for event, element in context:
            if event == "start" and element.tag == f"{NS}row":
                row_number += 1
                current_row = True
                continue

            if (
                event == "end"
                and element.tag == f"{NS}c"
                and current_row
                and row_number > 1
            ):
                ref = element.attrib.get("r", "")
                if not ref.startswith("W"):
                    element.clear()
                    continue
                if element.attrib.get("t") != "s":
                    element.clear()
                    continue
                value_node = element.find(f"{NS}v")
                if (
                    value_node is not None
                    and value_node.text
                    and value_node.text.isdigit()
                ):
                    needed.add(int(value_node.text))
                element.clear()
                continue

            if event == "end" and element.tag == f"{NS}row":
                current_row = False
                element.clear()

    return needed


def resolve_shared_strings_subset(xlsx_path: Path, needed: set[int]) -> dict[int, str]:
    if not needed:
        return {}

    resolved: dict[int, str] = {}
    max_needed = max(needed)
    with ZipFile(xlsx_path) as zf, zf.open("xl/sharedStrings.xml") as fh:
        index = -1
        for _event, element in ET.iterparse(fh, events=("end",)):
            if element.tag != f"{NS}si":
                continue
            index += 1
            if index in needed:
                text = "".join(t.text or "" for t in element.iter(f"{NS}t"))
                resolved[index] = text
                if len(resolved) == len(needed):
                    break
            if index > max_needed and len(resolved) == len(needed):
                break
            element.clear()
    return resolved


def ingest_txt(conn: sqlite3.Connection, txt_path: Path) -> int:
    total = 0
    with txt_path.open("r", encoding="utf-8", errors="replace", newline="") as fh:
        reader = csv.reader(fh, delimiter="\t")
        next(reader, None)  # header
        for row_number, row in enumerate(reader, start=2):
            ruc = normalize_digits(row[21] if len(row) > 21 else "")
            doc_type = normalize_doc_type(row[22] if len(row) > 22 else "")
            doc_num = normalize_digits(row[23] if len(row) > 23 else "")
            phones = [
                normalize_phone_token(row[idx] if len(row) > idx else "")
                for idx in range(27, 54)
            ]
            key = build_key([ruc, doc_type, doc_num, *phones])
            upsert_count(conn, key, "txt", f"txt_row={row_number}")
            total += 1
    return total


def ingest_xlsx(
    conn: sqlite3.Connection,
    xlsx_path: Path,
    shared_subset: dict[int, str],
) -> int:
    total = 0
    phone_cols = [
        "AB",
        "AC",
        "AD",
        "AE",
        "AF",
        "AG",
        "AH",
        "AI",
        "AJ",
        "AK",
        "AL",
        "AM",
        "AN",
        "AO",
        "AP",
        "AQ",
        "AR",
        "AS",
        "AT",
        "AU",
        "AV",
        "AW",
        "AX",
        "AY",
        "AZ",
        "BA",
        "BB",
    ]
    colset = {"V", "W", "X", *phone_cols}

    with ZipFile(xlsx_path) as zf, zf.open("xl/worksheets/sheet1.xml") as fh:
        context = ET.iterparse(fh, events=("start", "end"))
        row_number = 0
        current_row: dict[str, str] | None = None

        for event, element in context:
            if event == "start" and element.tag == f"{NS}row":
                row_number += 1
                current_row = {}
                continue

            if event == "end" and element.tag == f"{NS}c" and current_row is not None:
                ref = element.attrib.get("r", "")
                match = re.match(r"([A-Z]+)(\d+)$", ref)
                if match:
                    col = match.group(1)
                    if col in colset:
                        value_node = element.find(f"{NS}v")
                        raw = (
                            ""
                            if value_node is None or value_node.text is None
                            else value_node.text
                        )
                        if (
                            col == "W"
                            and element.attrib.get("t") == "s"
                            and raw.isdigit()
                        ):
                            current_row[col] = shared_subset.get(int(raw), "")
                        else:
                            current_row[col] = raw
                element.clear()
                continue

            if event == "end" and element.tag == f"{NS}row" and current_row is not None:
                if row_number == 1:
                    element.clear()
                    continue

                ruc = normalize_digits(current_row.get("V", ""))
                doc_type = normalize_doc_type(current_row.get("W", ""))
                doc_num = normalize_digits(current_row.get("X", ""))
                phones = [
                    normalize_phone_token(current_row.get(col, ""))
                    for col in phone_cols
                ]
                key = build_key([ruc, doc_type, doc_num, *phones])
                upsert_count(conn, key, "xlsx", f"xlsx_row={row_number}")
                total += 1
                element.clear()

    return total


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Streaming multiset diff for Consolidado TXT vs XLSX (canonical key projection)."
    )
    parser.add_argument(
        "--txt",
        default="crates/pipeline/data/raw/Consolidado_RUC20_Representantes_OK.txt",
    )
    parser.add_argument(
        "--xlsx",
        default="crates/pipeline/data/raw/Consolidado_RUC20_Representantes_OK.xlsx",
    )
    parser.add_argument(
        "--out",
        default="crates/pipeline/data/build/staged/consolidado.diff-report.json",
    )
    parser.add_argument(
        "--sample-limit",
        type=int,
        default=20,
    )
    args = parser.parse_args()

    txt_path = Path(args.txt)
    xlsx_path = Path(args.xlsx)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(
        prefix="consolidado-diff-", suffix=".sqlite"
    ) as tmp:
        conn = sqlite3.connect(tmp.name)
        conn.execute("PRAGMA journal_mode = OFF")
        conn.execute("PRAGMA synchronous = OFF")
        conn.execute("PRAGMA temp_store = FILE")
        conn.execute(
            """
            CREATE TABLE key_counts (
                key TEXT PRIMARY KEY,
                txt_count INTEGER NOT NULL DEFAULT 0,
                xlsx_count INTEGER NOT NULL DEFAULT 0,
                sample_txt TEXT,
                sample_xlsx TEXT
            )
            """
        )

        txt_rows = ingest_txt(conn, txt_path)
        conn.commit()

        needed = collect_needed_shared_indexes(xlsx_path)
        shared_subset = resolve_shared_strings_subset(xlsx_path, needed)
        xlsx_rows = ingest_xlsx(conn, xlsx_path, shared_subset)
        conn.commit()

        mismatch_keys = conn.execute(
            "SELECT COUNT(*) FROM key_counts WHERE txt_count != xlsx_count"
        ).fetchone()[0]
        imbalance = conn.execute(
            "SELECT COALESCE(SUM(ABS(txt_count - xlsx_count)), 0) FROM key_counts"
        ).fetchone()[0]

        samples = conn.execute(
            """
            SELECT key, txt_count, xlsx_count, sample_txt, sample_xlsx
            FROM key_counts
            WHERE txt_count != xlsx_count
            ORDER BY ABS(txt_count - xlsx_count) DESC, key
            LIMIT ?
            """,
            (args.sample_limit,),
        ).fetchall()

        report = {
            "txt_path": str(txt_path),
            "xlsx_path": str(xlsx_path),
            "projection": "ruc|documento|nro_documento|telefono_ibk..telefono25",
            "txt_rows": txt_rows,
            "xlsx_rows": xlsx_rows,
            "mismatch_key_count": mismatch_keys,
            "total_count_imbalance": imbalance,
            "exact_match": mismatch_keys == 0,
            "samples": [
                {
                    "key": row[0],
                    "txt_count": row[1],
                    "xlsx_count": row[2],
                    "sample_txt": row[3],
                    "sample_xlsx": row[4],
                }
                for row in samples
            ],
        }

        out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report))


if __name__ == "__main__":
    main()
