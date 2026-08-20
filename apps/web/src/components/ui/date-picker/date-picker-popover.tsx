import { Portal } from "@solidjs/web";
import { Show, createEffect, createSignal, type Accessor } from "solid-js";

import type { CalendarDate } from "~/domain/time/calendar-date";

import { DatePickerCalendar } from "./date-picker-calendar";
import {
  isPreviousMonthDisabled,
  type VisibleMonth,
} from "./date-picker-model";

import styles from "./date-picker.module.css";

const VIEWPORT_PADDING = 8;
const POPOVER_FALLBACK_WIDTH = 280;
const POPOVER_FALLBACK_HEIGHT = 320;

interface DatePickerPopoverProps {
  isOpen: Accessor<boolean>;
  anchor: Accessor<HTMLElement | undefined>;
  selectedDate: CalendarDate | null;
  minDate: CalendarDate | null;
  visibleMonth: VisibleMonth;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelect: (date: CalendarDate) => void;
  onPopoverMount: (element: HTMLDialogElement | undefined) => void;
}

export function DatePickerPopover(props: DatePickerPopoverProps) {
  const [position, setPosition] = createSignal({ top: 0, left: 0 });
  let popoverRef: HTMLDialogElement | undefined;

  createEffect(
    () => props.isOpen(),
    (isOpen) => {
      if (!isOpen) {
        return;
      }

      const updatePosition = () => {
        const anchor = props.anchor();
        if (!anchor || typeof window === "undefined") {
          return;
        }

        const rect = anchor.getBoundingClientRect();
        const popoverWidth = popoverRef?.offsetWidth ?? POPOVER_FALLBACK_WIDTH;
        const popoverHeight =
          popoverRef?.offsetHeight ?? POPOVER_FALLBACK_HEIGHT;
        const left = Math.min(
          rect.left,
          window.innerWidth - popoverWidth - VIEWPORT_PADDING,
        );
        const fitsBelow =
          rect.bottom + VIEWPORT_PADDING + popoverHeight <=
          window.innerHeight - VIEWPORT_PADDING;
        const top = fitsBelow
          ? rect.bottom + VIEWPORT_PADDING
          : Math.max(
              VIEWPORT_PADDING,
              rect.top - popoverHeight - VIEWPORT_PADDING,
            );

        setPosition({
          top,
          left: Math.max(VIEWPORT_PADDING, left),
        });
      };

      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);

      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    },
  );

  return (
    <Show when={props.isOpen()}>
      <Portal>
        <dialog
          open
          class={styles.popover}
          aria-modal="false"
          style={{
            top: `${position().top}px`,
            left: `${position().left}px`,
          }}
          ref={(element) => {
            popoverRef = element;
            props.onPopoverMount(element);
          }}
        >
          <DatePickerCalendar
            visibleMonth={props.visibleMonth}
            selectedDate={props.selectedDate}
            minDate={props.minDate}
            isPreviousMonthDisabled={isPreviousMonthDisabled(
              props.visibleMonth,
              props.minDate,
            )}
            onMonthChange={props.onMonthChange}
            onYearChange={props.onYearChange}
            onPreviousMonth={props.onPreviousMonth}
            onNextMonth={props.onNextMonth}
            onSelect={props.onSelect}
          />
        </dialog>
      </Portal>
    </Show>
  );
}
