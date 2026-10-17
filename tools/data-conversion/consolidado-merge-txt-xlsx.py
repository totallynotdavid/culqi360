#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import re
import sqlite3
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
CELL_REF_RE = re.compile(r"([A-Z]+)(\d+)$")
NUMERIC_RE = re.compile(r"^-?\d+(?:\.\d+)?$")


def col_name(index_1_based: int) -> str:
    result = ""
    n = index_1_based
    while n > 0:
        n, rem = divmod(n - 1, 26)
        result = chr(65 + rem) + result
    return result


def is_excel_serial(value: str) -> bool:
    if not value or not NUMERIC_RE.match(value):
        return False
    try:
        raw = float(value)
    except ValueError:
        return False
    return 20_000 <= raw <= 80_000


def excel_serial_to_ddmmyyyy(value: str) -> str:
    serial = int(float(value))
    date = dt.date(1899, 12, 30) + dt.timedelta(days=serial)
    return date.strftime("%d/%m/%Y")


def normalize_cell(header: str, value: str) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    if "fecha" in header.lower() and is_excel_serial(text):
        return excel_serial_to_ddmmyyyy(text)
    if text.endswith(".0") and NUMERIC_RE.match(text):
        return text[:-2]
    return text


def upsert_row(conn: sqlite3.Connection, row_tsv: str, source: str) -> None:
    conn.execute(
        """
        INSERT INTO merged_rows(row_tsv, from_txt, from_xlsx)
        VALUES(?1, CASE WHEN ?2='txt' THEN 1 ELSE 0 END, CASE WHEN ?2='xlsx' THEN 1 ELSE 0 END)
        ON CONFLICT(row_tsv) DO UPDATE SET
            from_txt = CASE WHEN ?2='txt' THEN 1 ELSE from_txt END,
            from_xlsx = CASE WHEN ?2='xlsx' THEN 1 ELSE from_xlsx END
        """,
        (row_tsv, source),
    )


def ingest_txt(
    conn: sqlite3.Connection,
    txt_path: Path,
    row_cap: int | None,
) -> tuple[list[str], int]:
    with txt_path.open("r", encoding="utf-8", errors="replace", newline="") as fh:
        reader = csv.reader(fh, delimiter="\t")
        header = next(reader)
        header = [(h or "").strip() for h in header]

        input_rows = 0
        for row in reader:
            if row_cap is not None and input_rows >= row_cap:
                break
            input_rows += 1
            if len(row) < len(header):
                row = row + [""] * (len(header) - len(row))
            elif len(row) > len(header):
                row = row[: len(header)]
            normalized = [normalize_cell(header[i], row[i]) for i in range(len(header))]
            row_tsv = "\t".join(normalized)

            upsert_row(conn, row_tsv, "txt")

    return header, input_rows


def build_shared_string_db(conn: sqlite3.Connection, xlsx_path: Path) -> int:
    conn.execute(
        "CREATE TABLE shared_strings(id INTEGER PRIMARY KEY, value TEXT NOT NULL)"
    )
    total = 0
    with ZipFile(xlsx_path) as zf, zf.open("xl/sharedStrings.xml") as fh:
        idx = -1
        for _event, element in ET.iterparse(fh, events=("end",)):
            if element.tag != f"{NS}si":
                continue
            idx += 1
            value = "".join(t.text or "" for t in element.iter(f"{NS}t"))
            conn.execute(
                "INSERT INTO shared_strings(id, value) VALUES(?1, ?2)", (idx, value)
            )
            total += 1
            element.clear()
    conn.commit()
    return total


def shared_value(
    conn: sqlite3.Connection,
    idx_text: str,
    cache: dict[int, str],
    cache_limit: int = 200_000,
) -> str:
    if not idx_text or not idx_text.isdigit():
        return ""
    idx = int(idx_text)
    cached = cache.get(idx)
    if cached is not None:
        return cached
    row = conn.execute(
        "SELECT value FROM shared_strings WHERE id=?1",
        (idx,),
    ).fetchone()
    value = row[0] if row else ""
    if len(cache) >= cache_limit:
        cache.pop(next(iter(cache)))
    cache[idx] = value
    return value


def parse_xlsx_header(
    conn: sqlite3.Connection,
    xlsx_path: Path,
    columns: list[str],
    cache: dict[int, str],
) -> list[str]:
    colset = set(columns)
    header_map: dict[str, str] = {}
    with ZipFile(xlsx_path) as zf, zf.open("xl/worksheets/sheet1.xml") as fh:
        context = ET.iterparse(fh, events=("start", "end"))
        row_number = 0
        for event, element in context:
            if event == "start" and element.tag == f"{NS}row":
                row_number += 1
                continue
            if row_number != 1:
                if event == "end":
                    element.clear()
                continue
            if event == "end" and element.tag == f"{NS}c":
                ref = element.attrib.get("r", "")
                match = CELL_REF_RE.match(ref)
                if match:
                    col = match.group(1)
                    if col in colset:
                        t = element.attrib.get("t", "")
                        v_node = element.find(f"{NS}v")
                        raw = (
                            "" if v_node is None or v_node.text is None else v_node.text
                        )
                        if t == "s":
                            header_map[col] = shared_value(conn, raw, cache)
                        else:
                            header_map[col] = raw
                element.clear()
            if event == "end" and element.tag == f"{NS}row":
                break
    return [header_map.get(col, col) for col in columns]


def ingest_xlsx(
    conn_data: sqlite3.Connection,
    conn_shared: sqlite3.Connection,
    xlsx_path: Path,
    headers: list[str],
    columns: list[str],
    row_cap: int | None,
) -> int:
    colset = set(columns)
    input_rows = 0
    shared_cache: dict[int, str] = {}

    with ZipFile(xlsx_path) as zf, zf.open("xl/worksheets/sheet1.xml") as fh:
        context = ET.iterparse(fh, events=("start", "end"))
        row_number = 0
        row_values: dict[str, str] | None = None

        for event, element in context:
            if event == "start" and element.tag == f"{NS}row":
                row_number += 1
                row_values = {}
                continue

            if event == "end" and element.tag == f"{NS}c" and row_values is not None:
                ref = element.attrib.get("r", "")
                match = CELL_REF_RE.match(ref)
                if match:
                    col = match.group(1)
                    if col in colset:
                        t = element.attrib.get("t", "")
                        v_node = element.find(f"{NS}v")
                        raw = (
                            "" if v_node is None or v_node.text is None else v_node.text
                        )
                        if t == "s":
                            row_values[col] = shared_value(
                                conn_shared, raw, shared_cache
                            )
                        else:
                            row_values[col] = raw
                element.clear()
                continue

            if event == "end" and element.tag == f"{NS}row" and row_values is not None:
                if row_number == 1:
                    element.clear()
                    continue
                if row_cap is not None and input_rows >= row_cap:
                    break

                normalized = [
                    normalize_cell(headers[i], row_values.get(columns[i], ""))
                    for i in range(len(columns))
                ]
                row_tsv = "\t".join(normalized)
                upsert_row(conn_data, row_tsv, "xlsx")

                input_rows += 1
                element.clear()

    return input_rows


def write_output(
    conn: sqlite3.Connection,
    out_path: Path,
    header: list[str],
    sort_output: bool,
) -> int:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    rows = 0
    with out_path.open("w", encoding="utf-8", newline="") as fh:
        fh.write("\t".join(header) + "\n")
        query = (
            "SELECT row_tsv FROM merged_rows ORDER BY row_tsv"
            if sort_output
            else "SELECT row_tsv FROM merged_rows"
        )
        cursor = conn.execute(query)
        for (row_tsv,) in cursor:
            fh.write(row_tsv + "\n")
            rows += 1
    return rows


def build_report(conn: sqlite3.Connection) -> dict[str, int]:
    total_unique = conn.execute("SELECT COUNT(*) FROM merged_rows").fetchone()[0]
    only_txt = conn.execute(
        "SELECT COUNT(*) FROM merged_rows WHERE from_txt=1 AND from_xlsx=0"
    ).fetchone()[0]
    only_xlsx = conn.execute(
        "SELECT COUNT(*) FROM merged_rows WHERE from_txt=0 AND from_xlsx=1"
    ).fetchone()[0]
    overlap_exact = conn.execute(
        "SELECT COUNT(*) FROM merged_rows WHERE from_txt=1 AND from_xlsx=1"
    ).fetchone()[0]
    return {
        "total_unique_rows": total_unique,
        "rows_only_in_txt": only_txt,
        "rows_only_in_xlsx": only_xlsx,
        "rows_present_in_both_exact": overlap_exact,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Merge Consolidado TXT + XLSX into a deduplicated TSV."
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
        "--out-tsv",
        default="crates/pipeline/data/build/staged/Consolidado_RUC20_Representantes_MERGED.tsv",
    )
    parser.add_argument(
        "--out-report",
        default="crates/pipeline/data/build/staged/consolidado.merge-report.json",
    )
    parser.add_argument("--txt-row-cap", type=int, default=None)
    parser.add_argument("--xlsx-row-cap", type=int, default=None)
    parser.add_argument("--sort-output", action="store_true")
    args = parser.parse_args()

    txt_path = Path(args.txt)
    xlsx_path = Path(args.xlsx)
    out_tsv = Path(args.out_tsv)
    out_report = Path(args.out_report)
    out_report.parent.mkdir(parents=True, exist_ok=True)

    columns = [col_name(i) for i in range(1, 55)]  # A..BB

    with tempfile.TemporaryDirectory(prefix="consolidado-merge-") as tmp_dir:
        tmp_path = Path(tmp_dir)
        merge_db_path = tmp_path / "merge.sqlite"
        shared_db_path = tmp_path / "shared.sqlite"

        conn_merge = sqlite3.connect(str(merge_db_path))
        conn_merge.execute("PRAGMA journal_mode=DELETE")
        conn_merge.execute("PRAGMA synchronous=NORMAL")
        conn_merge.execute("PRAGMA temp_store=MEMORY")
        conn_merge.execute(
            """
            CREATE TABLE merged_rows(
                row_tsv TEXT PRIMARY KEY,
                from_txt INTEGER NOT NULL DEFAULT 0,
                from_xlsx INTEGER NOT NULL DEFAULT 0
            )
            """
        )

        header, txt_rows = ingest_txt(conn_merge, txt_path, args.txt_row_cap)
        conn_merge.commit()

        conn_shared = sqlite3.connect(str(shared_db_path))
        conn_shared.execute("PRAGMA journal_mode=OFF")
        conn_shared.execute("PRAGMA synchronous=OFF")
        shared_count = build_shared_string_db(conn_shared, xlsx_path)
        header_cache: dict[int, str] = {}
        xlsx_headers = parse_xlsx_header(conn_shared, xlsx_path, columns, header_cache)

        # Prefer TXT header as canonical schema if available and matching width.
        final_header = header if len(header) == len(columns) else xlsx_headers
        xlsx_rows = ingest_xlsx(
            conn_merge,
            conn_shared,
            xlsx_path,
            final_header,
            columns,
            args.xlsx_row_cap,
        )
        conn_merge.commit()

        written_rows = write_output(conn_merge, out_tsv, final_header, args.sort_output)
        overlap_stats = build_report(conn_merge)

        report = {
            "txt_path": str(txt_path),
            "xlsx_path": str(xlsx_path),
            "output_tsv": str(out_tsv),
            "txt_input_rows": txt_rows,
            "xlsx_input_rows": xlsx_rows,
            "shared_string_count": shared_count,
            "sort_output": args.sort_output,
            "output_rows": written_rows,
            **overlap_stats,
        }
        out_report.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report))


if __name__ == "__main__":
    main()
