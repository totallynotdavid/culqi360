import {
  addCalendarDays,
  addCalendarMonths,
  calendarDateFromParts,
  calendarDateParts,
  calendarMonthFromDate,
  type CalendarDate,
  type CalendarMonth,
} from "~/domain/time/calendar-date";
import type { SourceRow } from "~/server/merchant-stats/intake/types";

import type { SeedContext } from "../../shared/context";
import { CULQI_MERCHANT_REPORT_PROFILE as PROFILE } from "./profile";

const TRADE_HEADS = [
  "Bodega",
  "Minimarket",
  "Botica",
  "Restaurante",
  "Pollería",
  "Ferretería",
  "Cevichería",
  "Panadería",
  "Librería",
  "Boutique",
  "Barbería",
  "Cafetería",
];
const TRADE_TAILS = [
  "San Martín",
  "El Sol",
  "Los Andes",
  "La Molina",
  "Miraflores",
  "Surquillo",
  "El Dorado",
  "Central",
  "Primavera",
  "Real",
  "Don Pepe",
  "La Victoria",
];
const LEGAL_SUFFIXES = ["S.A.C.", "E.I.R.L.", "S.R.L.", "S.A."];

export interface MerchantSpec {
  ruc: string;
  merchantId: string;
  serialNumber: string | null;
  product: string;
  saleMonth: CalendarMonth;
  soldAt: CalendarDate;
  tradeName: string;
  legalName: string;
  mesa: string;
  subchannel: string;
  clientType: string;
  stockType: string;
  offerAmount: number;
  promotion: string;
  trialAt: CalendarDate | null;
  activatedAt: CalendarDate | null;
  lastTransactionAt: CalendarDate | null;
  m0Plus15dGpv: number;
  m0Plus15dTrx: number;
  series: Array<{ gpv: number; trx: number }>;
  // Culqi's usuario, carried by the file. Never a CRM user: it is who registered
  // the sale at Culqi, and it does not name the seller.
  culqiUserCode: string | null;
  culqiUserName: string | null;
  // Not part of the file. The seed writes it through setTarget, the way a human
  // would, because the dealer export carries no projection at all.
  projectedGpv: number | null;
}

export interface GenerateInput {
  context: SeedContext;
  linkedOrganizations: ReadonlyArray<{
    ruc: string;
    legalName: string;
    tradeName: string | null;
    // Pins this RUC's device to CULQIFULL with this exact serial, keyed by
    // RUC rather than array position so it survives LEAD_SPECS edits. Used to
    // make a fulfillment unit's serial deterministically match (or
    // deliberately mismatch) this device -- see MERCHANT_STATS_SERIAL_LINKS.
    serialOverride?: string;
  }>;
  totalMerchants: number;
}

// mulberry32: seeds reproduce byte for byte so the demo dashboard is stable.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateMerchants(input: GenerateInput): MerchantSpec[] {
  const rng = mulberry32(input.context.randomSeed);
  const saleMonths = cohortMonths(input.context.anchorDate);
  const requiredCaseMonth = saleMonths.at(-2);
  if (!requiredCaseMonth) {
    throw new Error("merchant_seed_missing_cohort_months");
  }
  const merchants: MerchantSpec[] = [];
  for (let index = 0; index < input.totalMerchants; index++) {
    const linkedOrganization = input.linkedOrganizations[index];
    const ruc = linkedOrganization?.ruc ?? syntheticRuc(rng, index);
    merchants.push(
      buildMerchant(
        rng,
        input,
        saleMonths,
        requiredCaseMonth,
        ruc,
        index,
        linkedOrganization,
      ),
    );
  }
  return merchants;
}

function buildMerchant(
  rng: () => number,
  input: GenerateInput,
  saleMonths: readonly CalendarMonth[],
  requiredCaseMonth: CalendarMonth,
  ruc: string,
  index: number,
  linkedOrganization: GenerateInput["linkedOrganizations"][number] | undefined,
): MerchantSpec {
  const pickedProduct = pickProduct(rng, index, input.totalMerchants);
  const pickedSerial = pickedProduct.hasSerial
    ? syntheticSerial(rng, index)
    : null;
  // Overridden after the fact, not before: pickProduct/syntheticSerial must
  // still run so every later merchant draws the same rng() sequence whether
  // or not this particular RUC is overridden.
  const serialOverride = linkedOrganization?.serialOverride;
  const product = serialOverride ? PROFILE.products[0] : pickedProduct;
  const saleMonth = index < 4 ? requiredCaseMonth : pickMonth(rng, saleMonths);
  const soldAt = dayWithin(rng, saleMonth);
  const series = buildSeries(rng);
  const [firstMonth = { gpv: 0, trx: 0 }] = series;
  const trade = `${pick(rng, TRADE_HEADS)} ${pick(rng, TRADE_TAILS)}`;
  const activated = index !== 3 && chance(rng, PROFILE.activationRate);
  const anchorDate = calendarDateFromInstant(input.context.anchorDate);
  const trialAt = addCalendarDays(soldAt, 2 + Math.floor(rng() * 8));
  const activationCandidate = addCalendarDays(
    trialAt,
    2 + Math.floor(rng() * 16),
  );
  const activatedAt =
    activated && activationCandidate <= anchorDate ? activationCandidate : null;

  return {
    ruc,
    merchantId: `2000000${(1_000_000 + index).toString()}`,
    serialNumber: serialOverride ?? pickedSerial,
    product: product.value,
    saleMonth,
    soldAt,
    tradeName: linkedOrganization?.tradeName ?? trade,
    legalName:
      linkedOrganization?.legalName ??
      `${trade.toUpperCase()} ${pick(rng, LEGAL_SUFFIXES)}`,
    mesa: weightedPick(rng, PROFILE.mesas).value,
    subchannel: weightedPick(rng, PROFILE.subchannels).value,
    clientType: weightedPick(rng, PROFILE.clientTypes).value,
    stockType: weightedPick(rng, PROFILE.stockTypes).value,
    offerAmount: pick(rng, PROFILE.offerAmounts),
    promotion: weightedPick(rng, PROFILE.promotions).value,
    trialAt,
    activatedAt,
    lastTransactionAt: activatedAt
      ? dateBetween(rng, activatedAt, anchorDate)
      : null,
    m0Plus15dGpv: round2(firstMonth.gpv * (0.2 + rng() * 0.4)),
    m0Plus15dTrx: Math.round(firstMonth.trx * (0.2 + rng() * 0.4)),
    series,
    ...culqiUser(rng, index),
    projectedGpv:
      linkedOrganization && index !== 2 && chance(rng, PROFILE.projectedGpvRate)
        ? round2(2000 + rng() * 45000)
        : null,
  };
}

// Culqi's usuarios. The demo keeps them separate so the reconciliation
// view cannot become a seller leaderboard by accident.
const CULQI_USERS = [
  "JULIO BENJAMIN ALLAUCA VALENCIA",
  "CLAUDIA EDITH RODRIGUEZ FLORES DE PEREZ",
  "GIORGIA AREZI SALDAÑA FARFAN",
  "MARVICK GIZZIANA FRANCO SAAVEDRA",
  "GRACIELA NATALIA AVILEZ ESCUDERO",
  "JORGE ANTONIO INOÑAN SUAREZ",
  "VERONICA VANESA BANQUEZ BARRETO",
  "ELVIS FRANCO FERNANDEZ FLORES",
];

function culqiUser(
  rng: () => number,
  index: number,
): Pick<MerchantSpec, "culqiUserCode" | "culqiUserName"> {
  // A handful of rows arrive with no usuario at all, as they do in the export.
  if (index % 23 === 0) {
    return { culqiUserCode: null, culqiUserName: null };
  }
  const slot = Math.floor(rng() * CULQI_USERS.length);
  return {
    culqiUserCode: `V${(100 + slot).toString()}`,
    culqiUserName: CULQI_USERS[slot] ?? null,
  };
}

// Heavy-tailed monthly GPV with an m0..m3 decay. Most accounts are small,
// a few are large; later cohort months thin out as merchants churn.
function buildSeries(rng: () => number): Array<{ gpv: number; trx: number }> {
  const scale = tailedScale(rng);
  const decay = [1, 0.9 + rng() * 0.3, 0.6 + rng() * 0.3, 0.3 + rng() * 0.3];
  return decay.map((factor, offset) => {
    const alive = chance(rng, PROFILE.monthlyNonZeroRates[offset] ?? 0);
    if (!alive) {
      return { gpv: 0, trx: 0 };
    }
    const gpv = round2(scale * factor * (0.7 + rng() * 0.6));
    const ticket = 40 + rng() * 120;
    return { gpv, trx: Math.max(1, Math.round(gpv / ticket)) };
  });
}

function tailedScale(rng: () => number): number {
  const r = rng();
  const q = PROFILE.gpvM0Quantiles;
  if (r < 0.5) {
    return rng() * q.p50;
  }
  if (r < 0.75) {
    return q.p50 + rng() * (q.p75 - q.p50);
  }
  if (r < 0.9) {
    return q.p75 + rng() * (q.p90 - q.p75);
  }
  if (r < 0.99) {
    return q.p90 + rng() * (q.p99 - q.p90);
  }
  return q.p99 + rng() * q.p99 * 1.5;
}

// Cohort metrics past the snapshot month are dropped, matching the decoder's
// cutMonth rule.
export function toSourceRow(
  merchant: MerchantSpec,
  rowNumber: number,
  cutDate: CalendarDate,
): SourceRow {
  const cutMonth = calendarMonthFromDate(cutDate);
  const gpv = merchant.series.flatMap((point, offset) => {
    if (addCalendarMonths(merchant.saleMonth, offset) > cutMonth) {
      return [];
    }
    return [{ offset, gpv: point.gpv, trx: point.trx }];
  });

  return {
    rowNumber,
    ruc: merchant.ruc,
    merchantId: merchant.merchantId,
    serialNumber: merchant.serialNumber,
    product: merchant.product,
    soldAt: merchant.soldAt,
    saleMonth: merchant.saleMonth,
    tradeName: merchant.tradeName,
    legalName: merchant.legalName,
    culqiUserCode: merchant.culqiUserCode,
    culqiUserName: merchant.culqiUserName,
    mesa: merchant.mesa,
    channel: "DEALERS",
    subchannel: merchant.subchannel,
    offerAmount: merchant.offerAmount,
    promotion: merchant.promotion,
    clientType: merchant.clientType,
    stockType: merchant.stockType,
    trialAt:
      merchant.trialAt && merchant.trialAt <= cutDate ? merchant.trialAt : null,
    activatedAt:
      merchant.activatedAt && merchant.activatedAt <= cutDate
        ? merchant.activatedAt
        : null,
    lastTransactionAt:
      merchant.lastTransactionAt && merchant.lastTransactionAt <= cutDate
        ? merchant.lastTransactionAt
        : null,
    m0Plus15dGpv: merchant.m0Plus15dGpv,
    m0Plus15dTrx: merchant.m0Plus15dTrx,
    gpv,
    raw: buildRawRecord(merchant),
  };
}

function buildRawRecord(merchant: MerchantSpec): Record<string, string> {
  return {
    identificador_tributario: merchant.ruc,
    id_merchant: merchant.merchantId,
    num_serie: merchant.serialNumber ?? "",
    producto: merchant.product,
    fecha_venta: merchant.soldAt,
    anomes_vta: merchant.saleMonth.slice(0, 7).replace("-", ""),
    nbr_comercial: merchant.tradeName,
    nbr_razon_social: merchant.legalName,
    gpv_m0: (merchant.series[0]?.gpv ?? 0).toString(),
  };
}

function syntheticRuc(rng: () => number, index: number): string {
  const prefix = chance(rng, 0.85) ? "20" : "10";
  const body = (10_000_000 + index * 7919 + Math.floor(rng() * 900))
    .toString()
    .padStart(8, "0")
    .slice(0, 8);
  const base = `${prefix}${body}`;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = base
    .split("")
    .reduce(
      (total, digit, position) =>
        total + Number(digit) * (weights[position] ?? 0),
      0,
    );
  const remainder = 11 - (sum % 11);
  const checkDigit = remainder === 10 ? 0 : remainder === 11 ? 1 : remainder;
  return `${base}${checkDigit}`;
}

function syntheticSerial(rng: () => number, index: number): string {
  const block = (index * 13 + Math.floor(rng() * 9000))
    .toString()
    .padStart(10, "0");
  return `P3C325${block}`;
}

function pickProduct(
  rng: () => number,
  index: number,
  totalMerchants: number,
): (typeof PROFILE.products)[number] {
  if (index === 1 || index === totalMerchants - 2) {
    return PROFILE.products[1];
  }
  if (index === 2 || index === totalMerchants - 1) {
    return PROFILE.products[2];
  }
  return weightedPick(rng, PROFILE.products);
}

function weightedPick<T extends { weight: number }>(
  rng: () => number,
  items: readonly T[],
): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  const r = rng() * total;
  let acc = 0;
  for (const item of items) {
    acc += item.weight;
    if (r <= acc) {
      return item;
    }
  }
  const [first] = items;
  if (first === undefined) {
    throw new Error("Cannot pick from an empty list");
  }
  return first;
}

function pickMonth(
  rng: () => number,
  months: readonly CalendarMonth[],
): CalendarMonth {
  // Bias toward recent cohorts: square the roll so low indices are rarer.
  const skewed = 1 - rng() * rng();
  const month =
    months[Math.min(months.length - 1, Math.floor(skewed * months.length))];
  if (month === undefined) {
    throw new Error("Cannot pick from an empty list of months");
  }
  return month;
}

function cohortMonths(anchorDate: Date): CalendarMonth[] {
  const currentMonth = calendarMonthFromDate(
    calendarDateFromInstant(anchorDate),
  );
  return Array.from({ length: PROFILE.cohortWindowMonths }, (_, index) =>
    addCalendarMonths(currentMonth, index - PROFILE.cohortWindowMonths + 1),
  );
}

function dayWithin(rng: () => number, month: CalendarMonth): CalendarDate {
  const day = 1 + Math.floor(rng() * 27);
  return calendarDateFromParts({
    year: Number(month.slice(0, 4)),
    month: Number(month.slice(5, 7)),
    day,
  });
}

function dateBetween(
  rng: () => number,
  start: CalendarDate,
  end: CalendarDate,
): CalendarDate {
  const startParts = calendarDateParts(start);
  const endParts = calendarDateParts(end);
  const startMs = Date.UTC(
    startParts.year,
    startParts.month - 1,
    startParts.day,
  );
  const endMs = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
  const offsetDays = Math.floor(rng() * ((endMs - startMs) / 86_400_000 + 1));
  return addCalendarDays(start, offsetDays);
}

function calendarDateFromInstant(instant: Date): CalendarDate {
  return calendarDateFromParts({
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
    day: instant.getUTCDate(),
  });
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) {
    throw new Error("Cannot pick from an empty list");
  }
  return item;
}

function chance(rng: () => number, probability: number): boolean {
  return rng() < probability;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
