import { APP_LOCALE } from "~/shared/locale";

import {
  addCalendarDays,
  addCalendarMonths,
  calendarDateFromParts,
  calendarDateParts,
  calendarMonthFromDate,
  calendarMonthParts,
  calendarMonthStart,
  type CalendarDate,
  type CalendarMonth,
} from "./calendar-date";

const APP_UTC_OFFSET_MINUTES = -5 * 60;

const APP_UTC_OFFSET_MS = APP_UTC_OFFSET_MINUTES * 60_000;

export type InstantRange = {
  start: Date;
  endExclusive: Date;
};

const APP_DATE_FORMAT = new Intl.DateTimeFormat(APP_LOCALE, {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const APP_DATE_TIME_FORMAT = new Intl.DateTimeFormat(APP_LOCALE, {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "UTC",
});

const APP_LONG_DATE_FORMAT = new Intl.DateTimeFormat(APP_LOCALE, {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const APP_MONTH_NAME_FORMAT = new Intl.DateTimeFormat(APP_LOCALE, {
  month: "long",
  timeZone: "UTC",
});

export const APP_MONTH_NAMES: readonly string[] = Array.from(
  { length: 12 },
  (_, index) => APP_MONTH_NAME_FORMAT.format(Date.UTC(2000, index, 1)),
);

export function formatCalendarMonthName(month: CalendarMonth): string {
  return APP_MONTH_NAME_FORMAT.format(
    Date.UTC(2000, calendarMonthParts(month).month - 1, 1),
  );
}

export function appCalendarDateAt(instant: Date | number): CalendarDate {
  const shifted = new Date(toEpochMilliseconds(instant) + APP_UTC_OFFSET_MS);

  return calendarDateFromParts({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

export function appCalendarDateBefore(instant: Date | number): CalendarDate {
  return appCalendarDateAt(toEpochMilliseconds(instant) - 1);
}

export function appInstantAt(date: CalendarDate, hour = 0, minute = 0): Date {
  const wallClock = utcDate(calendarDateParts(date));

  wallClock.setUTCHours(hour, minute, 0, 0);

  return new Date(wallClock.getTime() - APP_UTC_OFFSET_MS);
}

export function appDayRange(date: CalendarDate): InstantRange {
  return {
    start: appInstantAt(date),
    endExclusive: appInstantAt(addCalendarDays(date, 1)),
  };
}

export function appMonthRange(instant: Date): {
  month: CalendarMonth;
  start: Date;
  endExclusive: Date;
} {
  const month = calendarMonthFromDate(appCalendarDateAt(instant));
  const start = appDayRange(calendarMonthStart(month)).start;
  const nextMonth = addCalendarMonths(month, 1);
  const endExclusive = appDayRange(calendarMonthStart(nextMonth)).start;

  return { month, start, endExclusive };
}

export function formatAppDate(instant: Date | number): string {
  return APP_DATE_FORMAT.format(shiftToAppTime(instant));
}

export function formatCalendarDate(date: CalendarDate): string {
  return APP_DATE_FORMAT.format(utcDate(calendarDateParts(date)));
}

export function formatCalendarLongDate(date: CalendarDate): string {
  return APP_LONG_DATE_FORMAT.format(utcDate(calendarDateParts(date)));
}

export function formatAppDateTime(instant: Date | number): string {
  return APP_DATE_TIME_FORMAT.format(shiftToAppTime(instant));
}

export function formatAppLongDate(instant: Date | number): string {
  return APP_LONG_DATE_FORMAT.format(shiftToAppTime(instant));
}

function shiftToAppTime(instant: Date | number): number {
  return toEpochMilliseconds(instant) + APP_UTC_OFFSET_MS;
}

function toEpochMilliseconds(instant: Date | number): number {
  return typeof instant === "number" ? instant : instant.getTime();
}

function utcDate(parts: { year: number; month: number; day: number }): Date {
  const date = new Date(0);

  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(0, 0, 0, 0);

  return date;
}
