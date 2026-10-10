import { read, utils, type WorkBook, type WorkSheet } from "xlsx";

import { fail, type DomainError } from "~/domain/errors";
import {
  calendarDateFromParts,
  calendarMonthFromDate,
} from "~/domain/time/calendar-date";
import { Err, isErr, Ok, type Result } from "~/shared/result";

import {
  GPV_REQUIRED_HEADERS,
  headerSetHasAll,
  normalizeGpvHeader,
} from "./columns";
import { decodeRow } from "./decode-row";
import type { GpvCellValue, ParsedReport, Rejection, SourceRow } from "./types";

interface ExtractedSheet {
  headers: string[];
  rows: GpvCellValue[][];
}

export interface ParseReportInput {
  cutAt: Date;
}

export function parseReport(
  bytes: Uint8Array,
  input: ParseReportInput,
): Result<ParsedReport, DomainError> {
  const workbook = read(bytes, { type: "array", cellDates: true });
  const sheet = selectGpvSheet(workbook);

  if (isErr(sheet)) {
    return sheet;
  }

  const cutDate = calendarDateFromParts({
    year: input.cutAt.getUTCFullYear(),
    month: input.cutAt.getUTCMonth() + 1,
    day: input.cutAt.getUTCDate(),
  });
  const cutMonth = calendarMonthFromDate(cutDate);
  const rows: SourceRow[] = [];
  const rejections: Rejection[] = [];

  sheet.value.rows.forEach((cells, index) => {
    const decoded = decodeRow({
      rowNumber: index + 1,
      headers: sheet.value.headers,
      cells,
      cutMonth,
    });

    if (isErr(decoded)) {
      rejections.push(decoded.error);
      return;
    }

    rows.push(decoded.value);
  });

  return Ok({ rows, rejections });
}

// Prefer the matching sheet with the most data rows over summary sheets.
function selectGpvSheet(
  workbook: WorkBook,
): Result<ExtractedSheet, DomainError> {
  const candidates: ExtractedSheet[] = [];

  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name];

    if (!worksheet) {
      continue;
    }

    const extracted = extractSheet(worksheet);

    if (extracted) {
      candidates.push(extracted);
    }
  }

  if (candidates.length === 0) {
    return Err(fail("gpv_no_worksheet"));
  }

  return Ok(
    candidates.reduce((best, sheet) =>
      sheet.rows.length > best.rows.length ? sheet : best,
    ),
  );
}

function extractSheet(worksheet: WorkSheet): ExtractedSheet | null {
  const grid = utils.sheet_to_json<GpvCellValue[]>(worksheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  for (const [index, headerRow] of grid.entries()) {
    const headers = headerRow.map((cell) =>
      normalizeGpvHeader(String(cell ?? "")),
    );

    if (!headerSetHasAll(headers, GPV_REQUIRED_HEADERS)) {
      continue;
    }

    const rows = grid
      .slice(index + 1)
      .filter((row) => row.some((cell) => cell != null && cell !== ""));

    return { headers, rows };
  }

  return null;
}
