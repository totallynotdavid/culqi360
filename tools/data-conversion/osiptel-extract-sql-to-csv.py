#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
from pathlib import Path

INSERT_PREFIX = "INSERT INTO `osiptel` VALUES ("
INSERT_SUFFIX = ");"


def parse_values(payload: str) -> list[str]:
    values: list[str] = []
    i = 0
    n = len(payload)

    while i < n:
        while i < n and payload[i].isspace():
            i += 1
        if i >= n:
            break

        if payload.startswith("NULL", i):
            values.append("")
            i += 4
        elif payload[i] == "'":
            i += 1
            out_chars: list[str] = []
            while i < n:
                ch = payload[i]
                if ch == "'":
                    if i + 1 < n and payload[i + 1] == "'":
                        out_chars.append("'")
                        i += 2
                        continue
                    i += 1
                    break
                out_chars.append(ch)
                i += 1
            values.append("".join(out_chars))
        else:
            start = i
            while i < n and payload[i] not in ",)":
                i += 1
            values.append(payload[start:i].strip())

        while i < n and payload[i].isspace():
            i += 1
        if i < n and payload[i] == ",":
            i += 1

    return values


def extract_rows(input_path: Path, output_path: Path, row_cap: int | None) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    written = 0
    with (
        input_path.open("r", encoding="utf-8", errors="replace") as src,
        output_path.open("w", encoding="utf-8", newline="") as dst,
    ):
        writer = csv.writer(dst)

        for line in src:
            if row_cap is not None and written >= row_cap:
                break
            stripped = line.strip()
            if not stripped.startswith(INSERT_PREFIX) or not stripped.endswith(
                INSERT_SUFFIX
            ):
                continue

            payload = stripped[len(INSERT_PREFIX) : -len(INSERT_SUFFIX)]
            values = parse_values(payload)
            if len(values) != 14:
                continue

            writer.writerow(values)
            written += 1

    print(f"written_rows={written} output={output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract osiptel SQL INSERT rows into CSV (streaming)."
    )
    parser.add_argument(
        "--input",
        default="crates/pipeline/data/raw/osiptel_2025.sql",
        help="Path to osiptel SQL dump",
    )
    parser.add_argument(
        "--output",
        default="crates/pipeline/data/build/staged/osiptel.sample.csv",
        help="Output CSV path",
    )
    parser.add_argument(
        "--row-cap",
        type=int,
        default=None,
        help="Maximum rows to extract. Omit for full extraction.",
    )
    args = parser.parse_args()

    if args.row_cap is not None and args.row_cap < 1:
        raise SystemExit("--row-cap must be >= 1")

    extract_rows(Path(args.input), Path(args.output), args.row_cap)


if __name__ == "__main__":
    main()
