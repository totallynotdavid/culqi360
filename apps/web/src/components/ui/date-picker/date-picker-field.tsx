import { clsx } from "clsx";
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  onSettled,
} from "solid-js";

import { useHotkey } from "~/browser/hotkey/use-hotkey";
import CalendarDays from "~/components/icons/calendar-days";
import { appCalendarDateAt } from "~/domain/time/app-time";
import { parseCalendarDate } from "~/domain/time/calendar-date";

import { getVisibleMonth, shiftVisibleMonth } from "./date-picker-model";
import { DatePickerPopover } from "./date-picker-popover";

import styles from "./date-picker.module.css";

export interface DatePickerProps {
  label?: string;
  description?: string;
  error?: string;
  value: string;
  min?: string;
  required?: boolean;
  id?: string;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  onInput: (value: string) => void;
}

export function DatePicker(props: DatePickerProps) {
  const inputId = props.id ?? createUniqueId();
  const messageId = `${inputId}-message`;

  const [isOpen, setIsOpen] = createSignal(false);
  const selectedDate = createMemo(() => parseCalendarDate(props.value));
  const minDate = createMemo(() => parseCalendarDate(props.min ?? ""));
  const referenceDate = createMemo(
    () => selectedDate() ?? minDate() ?? appCalendarDateAt(Date.now()),
  );
  const [viewMonth, setViewMonth] = createSignal(
    getVisibleMonth(referenceDate()),
  );

  let fieldRef: HTMLDivElement | undefined;
  let anchorRef: HTMLDivElement | undefined;
  let popoverRef: HTMLDialogElement | undefined;

  const hasMessage = () => Boolean(props.error || props.description);

  const closePicker = () => {
    setIsOpen(false);
  };

  const syncViewMonth = () => {
    setViewMonth(getVisibleMonth(referenceDate()));
  };

  const openPicker = () => {
    syncViewMonth();
    setIsOpen(true);
  };

  onSettled(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!isOpen()) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (fieldRef?.contains(target) || popoverRef?.contains(target)) {
        return;
      }

      closePicker();
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  });

  useHotkey("Escape", closePicker, {
    enabled: isOpen,
    allowInInputs: true,
  });

  createEffect(isOpen, (open) => {
    if (!open) {
      syncViewMonth();
    }
  });

  return (
    <div
      class={styles.field}
      ref={(element) => {
        fieldRef = element;
      }}
    >
      {props.label && (
        <label for={inputId} class={styles.label}>
          {props.label}
          {props.required && (
            <span aria-hidden="true" class={styles.required}>
              *
            </span>
          )}
        </label>
      )}

      <div
        class={clsx(
          styles.controlShell,
          props.error ? styles.errorShell : undefined,
          isOpen() ? styles.openShell : undefined,
        )}
        ref={(element) => {
          anchorRef = element;
        }}
      >
        <input
          id={inputId}
          name={props.name}
          class={styles.control}
          type="text"
          inputmode="numeric"
          autocomplete="off"
          spellcheck={false}
          placeholder={props.placeholder ?? "AAAA-MM-DD"}
          value={props.value}
          aria-describedby={hasMessage() ? messageId : undefined}
          aria-invalid={props.error ? "true" : undefined}
          disabled={props.disabled}
          onFocus={openPicker}
          onInput={(event) => {
            props.onInput(event.currentTarget.value);

            if (!isOpen()) {
              openPicker();
            }
          }}
        />

        <button
          type="button"
          class={styles.iconButton}
          aria-label="Abrir calendario"
          aria-haspopup="dialog"
          aria-expanded={isOpen() ? "true" : "false"}
          disabled={props.disabled}
          onClick={() => {
            if (isOpen()) {
              closePicker();
              return;
            }

            openPicker();
          }}
        >
          <CalendarDays size={16} />
        </button>
      </div>

      {hasMessage() && (
        <p
          id={messageId}
          class={props.error ? styles.errorText : styles.descriptionText}
        >
          {props.error ?? props.description}
        </p>
      )}

      <DatePickerPopover
        isOpen={isOpen}
        anchor={() => anchorRef ?? fieldRef}
        selectedDate={selectedDate()}
        minDate={minDate()}
        visibleMonth={viewMonth()}
        onMonthChange={(month) =>
          setViewMonth((current) => ({
            year: current.year,
            month,
          }))
        }
        onYearChange={(year) =>
          setViewMonth((current) => ({
            year,
            month: current.month,
          }))
        }
        onPreviousMonth={() =>
          setViewMonth((current) => shiftVisibleMonth(current, -1))
        }
        onNextMonth={() =>
          setViewMonth((current) => shiftVisibleMonth(current, 1))
        }
        onSelect={(date) => {
          props.onInput(date);
          closePicker();
        }}
        onPopoverMount={(element) => {
          popoverRef = element;
        }}
      />
    </div>
  );
}
