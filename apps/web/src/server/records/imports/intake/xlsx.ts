import { read, utils } from "xlsx";

import type { RecordImportType } from "~/contracts/records/imports";

import {
  normalizeHeader,
  PRIORITY_IMPORT_HEADERS_ALT,
  PRIORITY_IMPORT_HEADERS,
  STATUS_IMPORT_HEADERS_ALT,
  STATUS_IMPORT_HEADERS,
} from "./contracts";

interface ExtractedRows {
  importType: RecordImportType;
  headers: string[];
  rows: string[][];
}

function detectImportType(normalized: string[]): RecordImportType | null {
  if (
    normalized.length === STATUS_IMPORT_HEADERS.length &&
    normalized.every((h, i) => h === STATUS_IMPORT_HEADERS[i])
  ) {
    return "import_status";
  }
  if (
    normalized.length === STATUS_IMPORT_HEADERS_ALT.length &&
    normalized.every((h, i) => h === STATUS_IMPORT_HEADERS_ALT[i])
  ) {
    return "import_status";
  }
  if (
    normalized.length === PRIORITY_IMPORT_HEADERS.length &&
    normalized.every((h, i) => h === PRIORITY_IMPORT_HEADERS[i])
  ) {
    return "import_prioridad";
  }
  if (
    normalized.length === PRIORITY_IMPORT_HEADERS_ALT.length &&
    normalized.every((h, i) => h === PRIORITY_IMPORT_HEADERS_ALT[i])
  ) {
    return "import_prioridad";
  }
  return null;
}

export function fromXlsx(buffer: ArrayBuffer): ExtractedRows {
  const wb = read(buffer, { type: "array" });
  const firstSheetName = wb.SheetNames[0];
  const ws =
    firstSheetName === undefined ? undefined : wb.Sheets[firstSheetName];
  if (!ws) {
    throw new Error("Workbook has no sheets");
  }

  const allRows = utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
  });

  for (const [i, headerRow] of allRows.entries()) {
    const normalized = headerRow.map((c) => normalizeHeader(c.trim()));
    const importType = detectImportType(normalized);

    if (importType !== null) {
      const rows = allRows
        .slice(i + 1)
        .map((r) => r.map((c) => c.trim()))
        .filter((row) => row.some((c) => c.length > 0));

      return { importType, headers: normalized, rows };
    }
  }

  throw new Error("XLSX headers do not match a supported import template");
}
