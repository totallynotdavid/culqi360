import { clsx } from "clsx";
import { For } from "solid-js";

import ChevronLeft from "~/components/icons/chevron-left";
import ChevronRight from "~/components/icons/chevron-right";
import type { CalendarDate } from "~/domain/time/calendar-date";

import {
  DAY_NAMES,
  MONTH_OPTIONS,
  buildCalendarCells,
  getYearOptions,
  type CalendarCell,
  type VisibleMonth,
} from "./date-picker-model";

import styles from "./date-picker.module.css";

interface DatePickerCalendarProps {
  visibleMonth: VisibleMonth;
  selectedDate: CalendarDate | null;
  minDate: CalendarDate | null;
  isPreviousMonthDisabled: boolean;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelect: (date: CalendarDate) => void;
}

export function DatePickerCalendar(props: DatePickerCalendarProps) {
  const yearOptions = () => getYearOptions(props.visibleMonth, props.minDate);
  const cells = () =>
    buildCalendarCells(props.visibleMonth, props.selectedDate, props.minDate);

  return (
    <>
      <div class={styles.header}>
        <select
          class={styles.select}
          value={String(props.visibleMonth.month)}
          onInput={(event) =>
            props.onMonthChange(Number(event.currentTarget.value))
          }
        >
          <For each={MONTH_OPTIONS}>
            {(option) => (
              <option
                value={String(option.value)}
                selected={option.value === props.visibleMonth.month}
              >
                {option.label}
              </option>
            )}
          </For>
        </select>
        <select
          class={styles.select}
          value={String(props.visibleMonth.year)}
          onInput={(event) =>
            props.onYearChange(Number(event.currentTarget.value))
          }
        >
          <For each={yearOptions()}>
            {(year) => (
              <option
                value={String(year)}
                selected={year === props.visibleMonth.year}
              >
                {year}
              </option>
            )}
          </For>
        </select>
        <button
          type="button"
          class={styles.navButton}
          aria-label="Mes anterior"
          disabled={props.isPreviousMonthDisabled}
          onClick={() => props.onPreviousMonth()}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          class={styles.navButton}
          aria-label="Mes siguiente"
          onClick={() => props.onNextMonth()}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div class={styles.dayNames}>
        <For each={DAY_NAMES}>
          {(dayName) => <span class={styles.dayName}>{dayName}</span>}
        </For>
      </div>
      <div class={styles.daysGrid}>
        <For each={cells()}>
          {(cell) => (
            <CalendarDayButton cell={cell} onSelect={props.onSelect} />
          )}
        </For>
      </div>
    </>
  );
}

function CalendarDayButton(props: {
  cell: CalendarCell;
  onSelect: (date: CalendarDate) => void;
}) {
  return (
    <button
      type="button"
      class={clsx(
        styles.dayButton,
        !props.cell.isCurrentMonth ? styles.dayOutsideMonth : undefined,
        props.cell.isSelected ? styles.daySelected : undefined,
      )}
      disabled={props.cell.isDisabled}
      aria-pressed={props.cell.isSelected ? "true" : "false"}
      onClick={() => props.onSelect(props.cell.date)}
    >
      {props.cell.label}
    </button>
  );
}
