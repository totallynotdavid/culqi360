import {
  getRequiredColumns,
  type BulkApplyResult,
  type BulkImportRow,
  type BulkParseResult,
  type BulkRowError,
} from "~/contracts/team/bulk-import";
import type { Role } from "~/domain/auth/access/rbac";
import { isExecutiveCategory } from "~/domain/identity/executive-category";
import type { BranchId, UserId, UserInviteId } from "~/domain/ids";
import { appCalendarDateAt, appDayRange } from "~/domain/time/app-time";
import {
  addCalendarDays,
  parseCalendarDate,
} from "~/domain/time/calendar-date";
import {
  parseCsvRows,
  readFirstNonEmptyCsvRow,
  type CsvDelimiter,
} from "~/server/csv/core";
import type { InviteService } from "~/server/invites/application/types";
import type { OperationContext } from "~/server/platform/operation/context";
import { Err, Ok, type Result } from "~/shared/result";

type ProvisioningInterface = Pick<
  InviteService,
  "createInvite" | "markInviteDelivered"
>;

type BulkImportError = {
  reason: "parse_error";
  message: string;
};

const MIN_EXPIRY_DAYS = 7;

export async function applyImport(
  rows: BulkImportRow[],
  actor: { userId: UserId; role: Role; branchId: BranchId },
  safeRole: Role,
  provisioning: ProvisioningInterface,
  onInviteCreated: (params: {
    row: BulkImportRow;
    inviteId: UserInviteId;
    token: string;
    expiresAt: Date;
  }) => Promise<void>,
  operation: OperationContext,
): Promise<BulkApplyResult> {
  let created = 0;
  let skipped = 0;
  const rowErrors: string[] = [];

  for (const row of rows) {
    try {
      // Invites are provisioned sequentially so each row observes current
      // duplicate and pending-invite state before delivery is recorded.
      // eslint-disable-next-line no-await-in-loop
      const result = await provisioning.createInvite(
        {
          actorUserId: actor.userId,
          actorRole: actor.role,
          branchId: actor.branchId,
          names: row.names,
          firstSurname: row.firstSurname,
          secondSurname: row.secondSurname,
          email: row.email,
          role: safeRole,
          executiveCategory: row.executiveCategory,
          teamId: null,
          expiresAt: row.expiresOn
            ? appDayRange(row.expiresOn).endExclusive
            : null,
        },
        operation,
      );

      if (!result.ok) {
        if (
          result.error.code === "active_user_exists" ||
          result.error.code === "pending_user_other_branch"
        ) {
          skipped++;
        } else {
          rowErrors.push(
            `${row.email}: ${result.error.code ?? result.error.kind}`,
          );
        }

        continue;
      }

      // Delivery follows the created invite immediately so a later row failure
      // cannot leave a successful row without its delivery side effect.
      // eslint-disable-next-line no-await-in-loop
      await onInviteCreated({
        row,
        inviteId: result.value.inviteId,
        token: result.value.token,
        expiresAt: result.value.expiresAt,
      });

      created++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      rowErrors.push(`${row.email}: ${message}`);
    }
  }

  return { created, skipped, rowErrors };
}

const BULK_IMPORT_DELIMITERS: readonly CsvDelimiter[] = [",", ";"] as const;

function normalizeBulkHeader(header: string): string {
  return header.trim().toUpperCase().replace(/\s+/g, "_");
}

function resolveBulkImportLayout(
  csv: string,
  role: Role,
):
  | {
      ok: true;
      delimiter: CsvDelimiter;
      headerRowNumber: number;
      columnIndex: Readonly<Record<string, number>>;
    }
  | {
      ok: false;
      message: string;
    } {
  const requiredColumns = getRequiredColumns(role);

  for (const delimiter of BULK_IMPORT_DELIMITERS) {
    const headerRow = readFirstNonEmptyCsvRow(csv, delimiter);

    if (!headerRow) {
      continue;
    }

    const header = headerRow.cells.map(normalizeBulkHeader);

    if (
      !requiredColumns.every((column, index) =>
        column === "EXECUTIVE_CATEGORY"
          ? header.includes(column)
          : header[index] === column,
      )
    ) {
      continue;
    }

    const columnIndex: Record<string, number> = {};

    for (const [index, column] of header.entries()) {
      columnIndex[column] = index;
    }

    return {
      ok: true,
      delimiter,
      headerRowNumber: headerRow.rowNumber,
      columnIndex,
    };
  }

  return {
    ok: false,
    message: `Encabezado inválido. Se esperaba: ${requiredColumns.join(",")}`,
  };
}

function readCell(
  row: readonly string[],
  columnIndex: Readonly<Record<string, number>>,
  column: string,
): string {
  const index = columnIndex[column];

  if (index === undefined) {
    return "";
  }

  return (row[index] ?? "").trim();
}

export function parseAndValidateCsvRows(
  csv: string,
  role: Role,
  importedAt: Date,
): Result<BulkParseResult, BulkImportError> {
  if (csv.trim().length === 0) {
    return Err({ reason: "parse_error", message: "El archivo CSV está vacío" });
  }

  const isExecutive = role === "executive";
  const layout = resolveBulkImportLayout(csv, role);

  if (!layout.ok) {
    return Err({
      reason: "parse_error",
      message: layout.message,
    });
  }

  const rows = parseCsvRows(csv, layout.delimiter);
  const valid: BulkImportRow[] = [];
  const errors: BulkRowError[] = [];
  const minimumExpiresOn = addCalendarDays(
    appCalendarDateAt(importedAt),
    MIN_EXPIRY_DAYS,
  );

  for (const row of rows) {
    if (row.rowNumber <= layout.headerRowNumber) {
      continue;
    }

    if (row.cells.every((cell) => cell.trim().length === 0)) {
      continue;
    }

    const firstSurname = readCell(
      row.cells,
      layout.columnIndex,
      "FIRST_SURNAME",
    );
    const secondSurname = readCell(
      row.cells,
      layout.columnIndex,
      "SECOND_SURNAME",
    );
    const names = readCell(row.cells, layout.columnIndex, "NAMES");
    const rawEmail = readCell(row.cells, layout.columnIndex, "EMAIL");
    const rawDate = readCell(row.cells, layout.columnIndex, "DATE_EXPIRY");
    const rawCategory = readCell(
      row.cells,
      layout.columnIndex,
      "EXECUTIVE_CATEGORY",
    ).toLowerCase();

    if (!firstSurname) {
      errors.push({ row: row.rowNumber, message: "Primer apellido requerido" });
      continue;
    }

    if (!secondSurname) {
      errors.push({
        row: row.rowNumber,
        message: "Segundo apellido requerido",
      });
      continue;
    }

    if (!names) {
      errors.push({ row: row.rowNumber, message: "Nombres requeridos" });
      continue;
    }

    if (!rawEmail) {
      errors.push({ row: row.rowNumber, message: "Correo requerido" });
      continue;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      errors.push({
        row: row.rowNumber,
        message: `Correo inválido: ${rawEmail}`,
      });
      continue;
    }

    let expiresOn: BulkImportRow["expiresOn"] = null;

    if (rawDate) {
      const parsed = parseCalendarDate(rawDate);

      if (!parsed) {
        errors.push({
          row: row.rowNumber,
          message: `Fecha inválida: ${rawDate}`,
        });
        continue;
      }

      if (parsed < minimumExpiresOn) {
        errors.push({
          row: row.rowNumber,
          message: `La fecha de vencimiento debe ser al menos 7 días en el futuro: ${rawDate}`,
        });
        continue;
      }

      expiresOn = parsed;
    }

    let executiveCategory: BulkImportRow["executiveCategory"] = null;

    if (isExecutive) {
      if (!isExecutiveCategory(rawCategory)) {
        errors.push({
          row: row.rowNumber,
          message: `Categoría de ejecutivo inválida: "${rawCategory}". Valores permitidos: elite, corporativa`,
        });
        continue;
      }

      executiveCategory = rawCategory;
    }

    valid.push({
      firstSurname,
      secondSurname,
      names,
      email: rawEmail.trim().toLowerCase(),
      expiresOn,
      executiveCategory,
    });
  }

  return Ok({ valid, errors });
}
