import { createEffect, createSignal } from "solid-js";

import { DatePicker } from "~/components/ui/date-picker/date-picker-field";
import {
  parseCalendarDate,
  type CalendarDate,
} from "~/domain/time/calendar-date";

type EventLogDatePickerInputProps = {
  label?: string;
  value: CalendarDate | undefined;
  placeholder?: string;
  onChange: (date: CalendarDate | undefined) => void;
};

export function EventLogDatePickerInput(props: EventLogDatePickerInputProps) {
  const [draft, setDraft] = createSignal(props.value ?? "");

  createEffect(
    () => props.value ?? "",
    (value) => {
      setDraft(value);
    },
  );

  return (
    <DatePicker
      label={props.label}
      placeholder={props.placeholder}
      value={draft()}
      onInput={(value) => {
        setDraft(value);
        if (!value) {
          props.onChange(undefined);
          return;
        }

        const date = parseCalendarDate(value);
        if (date) {
          props.onChange(date);
        }
      }}
    />
  );
}
