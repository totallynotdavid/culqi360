import { createSignal } from "solid-js";

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
  // Writable memo: typing overwrites the draft, a new value from the filter
  // recomputes it.
  const [draft, setDraft] = createSignal<string>(() => props.value ?? "");

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
