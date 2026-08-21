import type { Role } from "~/domain/auth/access/rbac";
import type { ExecutiveCategory } from "~/domain/identity/executive-category";
import type { CalendarDate } from "~/domain/time/calendar-date";

const CSV_COLUMNS = [
  "FIRST_SURNAME",
  "SECOND_SURNAME",
  "NAMES",
  "EMAIL",
  "DATE_EXPIRY",
  "EXECUTIVE_CATEGORY",
] as const;

export function getRequiredColumns(role: Role): readonly string[] {
  if (role === "executive") {
    return CSV_COLUMNS;
  }

  return CSV_COLUMNS.slice(0, 4);
}

export interface BulkImportRow {
  firstSurname: string;
  secondSurname: string;
  names: string;
  email: string;
  expiresOn: CalendarDate | null;
  executiveCategory: ExecutiveCategory | null;
}

export type BulkRowError = {
  row: number;
  message: string;
};

export interface BulkParseResult {
  valid: BulkImportRow[];
  errors: BulkRowError[];
}

export interface BulkPreviewResult {
  parsed: BulkParseResult;
}

export interface BulkApplyResult {
  created: number;
  skipped: number;
  rowErrors: string[];
}
