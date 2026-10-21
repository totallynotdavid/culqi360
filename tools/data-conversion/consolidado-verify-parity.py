#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NUM_RE = re.compile(r"\D+")


def normalize_digits(value: str) -> str:
    digits = NUM_RE.sub("", value or "")
    return digits.lstrip("0") or ("0" if digits else "")


def hash_parts(parts: list[str]) -> int:
    digest = hashlib.blake2b("|".join(parts).encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(digest, "big")


def summarize_txt(path: Path, indexes: list[int]) -> dict[str, int]:
    count = 0
    xor_hash = 0
    sum_hash = 0

    with path.open("r", encoding="utf-8", errors="replace", newline="") as fh:
        reader = csv.reader(fh, delimiter="\t")
        next(reader, None)  # header
        for row in reader:
            parts = [
                normalize_digits(row[idx] if idx < len(row) else "") for idx in indexes
            ]
            hv = hash_parts(parts)
            xor_hash ^= hv
            sum_hash = (sum_hash + hv) & ((1 << 64) - 1)
            count += 1

    return {"count": count, "xor_hash": xor_hash, "sum_hash": sum_hash}


def summarize_xlsx(path: Path, columns: list[str]) -> dict[str, int]:
    colset = set(columns)
    count = 0
    xor_hash = 0
    sum_hash = 0

    with ZipFile(path) as zf, zf.open("xl/worksheets/sheet1.xml") as fh:
        context = ET.iterparse(fh, events=("start", "end"))
        current_row: dict[str, str] | None = None
        row_number = 0

        for event, element in context:
            if event == "start" and element.tag == f"{NS}row":
                current_row = {}
                row_number += 1
                continue

            if event == "end" and element.tag == f"{NS}c" and current_row is not None:
                ref = element.attrib.get("r", "")
                match = re.match(r"([A-Z]+)(\d+)$", ref)
                if match:
                    column = match.group(1)
                    if column in colset:
                        value_node = element.find(f"{NS}v")
                        value = (
                            ""
                            if value_node is None or value_node.text is None
                            else value_node.text
                        )
                        current_row[column] = value
                element.clear()
                continue

            if event == "end" and element.tag == f"{NS}row" and current_row is not None:
                if row_number == 1:
                    element.clear()
                    continue
                parts = [
                    normalize_digits(current_row.get(column, "")) for column in columns
                ]
                hv = hash_parts(parts)
                xor_hash ^= hv
                sum_hash = (sum_hash + hv) & ((1 << 64) - 1)
                count += 1
                element.clear()

    return {"count": count, "xor_hash": xor_hash, "sum_hash": sum_hash}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Streaming parity check between Consolidado XLSX and TXT."
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
        default="crates/pipeline/data/build/staged/consolidado.parity.json",
    )
    args = parser.parse_args()

    xlsx_columns = [
        "V",  # ruc (representante section)
        "X",  # nro_documento
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
    txt_indexes = [21, 23, *range(27, 54)]

    txt_summary = summarize_txt(Path(args.txt), txt_indexes)
    xlsx_summary = summarize_xlsx(Path(args.xlsx), xlsx_columns)

    report = {
        "txt_path": args.txt,
        "xlsx_path": args.xlsx,
        "identity_projection": {
            "txt_indexes": txt_indexes,
            "xlsx_columns": xlsx_columns,
        },
        "txt_summary": txt_summary,
        "xlsx_summary": xlsx_summary,
        "count_equal": txt_summary["count"] == xlsx_summary["count"],
        "xor_equal": txt_summary["xor_hash"] == xlsx_summary["xor_hash"],
        "sum_equal": txt_summary["sum_hash"] == xlsx_summary["sum_hash"],
        "parity_match": txt_summary == xlsx_summary,
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
