import type { Mesa } from "~/contracts/merchant-stats/commission-views";
import {
  calendarMonthParts,
  type CalendarMonth,
} from "~/domain/time/calendar-date";

const SOLES = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 0,
});

const INTEGER = new Intl.NumberFormat("es-PE", {
  maximumFractionDigits: 0,
});

const MONTHS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export function formatSoles(value: number): string {
  return SOLES.format(value);
}

export function formatSolesCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `S/ ${(value / 1_000_000).toFixed(1)}M`;
  }

  if (Math.abs(value) >= 1_000) {
    return `S/ ${Math.round(value / 1_000)}K`;
  }

  return `S/ ${Math.round(value)}`;
}

export function formatInteger(value: number): string {
  return INTEGER.format(value);
}

export function formatMonth(value: CalendarMonth): string {
  const { year, month } = calendarMonthParts(value);

  return `${MONTHS_ES[month - 1]} ${String(year).slice(2)}`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatMesa(mesa: Mesa): string {
  return mesa.charAt(0) + mesa.slice(1).toLowerCase();
}

export function formatRatio(numerator: number, denominator: number): string {
  if (denominator === 0) {
    return "0%";
  }

  const ratio = (numerator / denominator) * 100;

  return `${Number(ratio.toFixed(1))}%`;
}
