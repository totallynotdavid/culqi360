import {
  GPV_MAX_MONTH_OFFSET,
  MERCHANT_PRODUCTS,
} from "~/contracts/merchant-stats/vocabulary";
import {
  addCalendarMonths,
  calendarMonthStart,
  type CalendarMonth,
} from "~/domain/time/calendar-date";
import { Err, Ok, type Result } from "~/shared/result";

import {
  cellDateOrNull,
  cellNumber,
  cellNumberOrNull,
  cellText,
  cellTextOrNull,
  saleMonthFromAnomes,
} from "./cells";
import { GPV_COLUMNS } from "./columns";
import type {
  GpvCellValue,
  GpvObservation,
  GpvRawRecord,
  Rejection,
  SourceRow,
} from "./types";

type Cells = Record<string, GpvCellValue>;

export interface DecodeRowInput {
  rowNumber: number;
  headers: readonly string[];
  cells: readonly GpvCellValue[];
  cutMonth: CalendarMonth;
}

export function decodeRow(input: DecodeRowInput): Result<SourceRow, Rejection> {
  const cells = toCells(input.headers, input.cells);
  const raw = toRawRecord(input.headers, input.cells);

  const ruc = cellText(cells[GPV_COLUMNS.ruc]);
  const merchantId = cellText(cells[GPV_COLUMNS.merchantId]);
  const saleMonth = saleMonthFromAnomes(cells[GPV_COLUMNS.saleMonth]);
  const soldAt =
    cellDateOrNull(cells[GPV_COLUMNS.soldAt]) ??
    (saleMonth ? calendarMonthStart(saleMonth) : null);

  if (!/^\d{6,}$/.test(ruc)) {
    return Err(
      reject(input.rowNumber, ruc, merchantId, cells, raw, "RUC inválido"),
    );
  }
  if (!merchantId) {
    return Err(
      reject(input.rowNumber, ruc, merchantId, cells, raw, "Falta id_merchant"),
    );
  }
  if (!saleMonth || !soldAt) {
    return Err(
      reject(
        input.rowNumber,
        ruc,
        merchantId,
        cells,
        raw,
        "Fecha de venta ausente o inválida",
      ),
    );
  }

  return Ok({
    rowNumber: input.rowNumber,
    ruc,
    merchantId,
    serialNumber: cellTextOrNull(cells[GPV_COLUMNS.serial]),
    product: normalizeProduct(cellText(cells[GPV_COLUMNS.product])),
    soldAt,
    saleMonth,
    tradeName: cellTextOrNull(cells[GPV_COLUMNS.tradeName]),
    legalName: cellTextOrNull(cells[GPV_COLUMNS.legalName]),
    culqiUserCode: cellTextOrNull(cells[GPV_COLUMNS.culqiUserCode]),
    culqiUserName: cellTextOrNull(cells[GPV_COLUMNS.culqiUserName]),
    mesa: cellTextOrNull(cells[GPV_COLUMNS.mesa]),
    channel: cellTextOrNull(cells[GPV_COLUMNS.channel]),
    subchannel: cellTextOrNull(cells[GPV_COLUMNS.subchannel]),
    offerAmount: cellNumberOrNull(cells[GPV_COLUMNS.offer]),
    promotion: cellTextOrNull(cells[GPV_COLUMNS.promotion]),
    clientType: cellTextOrNull(cells[GPV_COLUMNS.clientType]),
    stockType: cellTextOrNull(cells[GPV_COLUMNS.stockType]),
    trialAt: cellDateOrNull(cells[GPV_COLUMNS.trialAt]),
    activatedAt: cellDateOrNull(cells[GPV_COLUMNS.activatedAt]),
    lastTransactionAt: cellDateOrNull(cells[GPV_COLUMNS.lastTransactionAt]),
    m0Plus15dGpv: cellNumberOrNull(cells[GPV_COLUMNS.m0Plus15dGpv]),
    m0Plus15dTrx: cellNumberOrNull(cells[GPV_COLUMNS.m0Plus15dTrx]),
    gpv: readObservations(cells, saleMonth, input.cutMonth),
    raw,
  });
}

// The export stops carrying a cohort step once it would land past the cut, and
// a sale made this month has only m0. A missing column is therefore "not yet",
// not zero, and must not be written as a realized zero.
function readObservations(
  cells: Cells,
  saleMonth: CalendarMonth,
  cutMonth: CalendarMonth,
): GpvObservation[] {
  const observations: GpvObservation[] = [];
  for (let offset = 0; offset <= GPV_MAX_MONTH_OFFSET; offset++) {
    const gpvKey = `gpv_m${offset}`;
    if (!(gpvKey in cells)) {
      continue;
    }
    if (addCalendarMonths(saleMonth, offset) > cutMonth) {
      continue;
    }
    observations.push({
      offset,
      gpv: cellNumber(cells[gpvKey]),
      trx: cellNumber(cells[`trx_m${offset}`]),
    });
  }
  return observations;
}

function normalizeProduct(raw: string): string {
  const upper = raw.toUpperCase().replace(/\s+/g, "");
  return MERCHANT_PRODUCTS.find((product) => product === upper) ?? raw;
}

function toCells(
  headers: readonly string[],
  cells: readonly GpvCellValue[],
): Cells {
  const record: Cells = {};
  for (const [index, header] of headers.entries()) {
    record[header] = cells[index];
  }
  return record;
}

function toRawRecord(
  headers: readonly string[],
  cells: readonly GpvCellValue[],
): GpvRawRecord {
  const record: GpvRawRecord = {};
  for (const [index, header] of headers.entries()) {
    record[header] = cellText(cells[index]);
  }
  return record;
}

function reject(
  rowNumber: number,
  ruc: string,
  merchantId: string,
  cells: Cells,
  raw: GpvRawRecord,
  reason: string,
): Rejection {
  return {
    rowNumber,
    ruc: ruc || null,
    merchantId: merchantId || null,
    serialNumber: cellTextOrNull(cells[GPV_COLUMNS.serial]),
    reason,
    raw,
  };
}
