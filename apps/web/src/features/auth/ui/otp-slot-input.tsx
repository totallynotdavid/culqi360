import { For, createMemo, createSignal } from "solid-js";
import { type JSX } from "@solidjs/web";

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
      <For each={digits().slice(0, 3)}>
        {(digit, index) => (
          <div
            aria-hidden="true"
            classList={{
              [styles.slot]: true,
              [styles.slotActive]: activeIndex() === index(),
            }}
          >
            {digit ? digit : <span class={styles.placeholder}>X</span>}
            {!digit && activeIndex() === index() && (
              <span class={styles.caret} aria-hidden="true" />
            )}
          </div>
        )}
      </For>
      <span class={styles.dash} aria-hidden="true">
        <span class={styles.dashLine} />
      </span>
      <For each={digits().slice(3)}>
        {(digit, index) => (
          <div
            aria-hidden="true"
            classList={{
              [styles.slot]: true,
              [styles.slotActive]: activeIndex() === index() + 3,
            }}
          >
            {digit ? digit : <span class={styles.placeholder}>X</span>}
            {!digit && activeIndex() === index() + 3 && (
              <span class={styles.caret} aria-hidden="true" />
            )}
          </div>
        )}
      </For>
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
