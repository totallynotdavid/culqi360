import { type JSX } from "@solidjs/web";
import { For, createMemo, createSignal } from "solid-js";

import styles from "./otp-slot-input.module.css";

interface OtpSlotInputProps {
  value: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
}

const SLOT_COUNT = 6;

function normalizeOtp(value: string): string {
  return value.replace(/\D/g, "").slice(0, SLOT_COUNT);
}

function OtpSlotGroup(props: {
  digits: ReadonlyArray<string>;
  offset: number;
  activeIndex: number | null;
}) {
  return (
    <For each={props.digits} keyed={false}>
      {(digit, index) => {
        const active = () => props.activeIndex === props.offset + index;

        return (
          <div
            aria-hidden="true"
            class={[styles.slot, active() && styles.slotActive]}
          >
            {digit() ? digit() : <span class={styles.placeholder}>X</span>}
            {!digit() && active() && (
              <span class={styles.caret} aria-hidden="true" />
            )}
          </div>
        );
      }}
    </For>
  );
}

export function OtpSlotInput(props: OtpSlotInputProps) {
  const [focused, setFocused] = createSignal(false);

  const digits = createMemo(() => {
    const normalized = normalizeOtp(props.value);
    return Array.from(
      { length: SLOT_COUNT },
      (_, index) => normalized[index] ?? "",
    );
  });

  const activeIndex = createMemo(() => {
    if (!focused()) {
      return null;
    }
    return Math.min(normalizeOtp(props.value).length, SLOT_COUNT - 1);
  });

  const handleInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (
    event,
  ) => {
    props.onValueChange(normalizeOtp(event.currentTarget.value));
  };

  return (
    <div class={styles.container}>
      <OtpSlotGroup
        digits={digits().slice(0, 3)}
        offset={0}
        activeIndex={activeIndex()}
      />
      <span class={styles.dash} aria-hidden="true">
        <span class={styles.dashLine} />
      </span>
      <OtpSlotGroup
        digits={digits().slice(3)}
        offset={3}
        activeIndex={activeIndex()}
      />
      <input
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength={SLOT_COUNT}
        pattern="\d{6}"
        name="otp"
        aria-label="Codigo de verificacion de 6 digitos"
        class={styles.input}
        value={props.value}
        disabled={props.disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onInput={handleInput}
      />
    </div>
  );
}
