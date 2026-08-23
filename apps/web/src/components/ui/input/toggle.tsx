import { createMotion } from "@crm/solid-motion";
import { clsx } from "clsx";

import { CONTROL_SPRING } from "~/components/ui/animation/springs";

import styles from "./toggle.module.css";

export function Toggle(props: {
  value?: boolean;
  disabled?: boolean;
  id?: string;
  ariaLabel: string;
  onChange?: (value: boolean) => void;
  color?: string;
}) {
  const offset = () => (props.value ? 14 : 2);
  // `initial` is read once, so the knob is born where it belongs and only a
  // change to `value` animates it.
  const knob = createMotion(() => ({
    initial: { x: offset() },
    animate: { x: offset() },
    transition: CONTROL_SPRING,
  }));

  return (
    <label
      aria-label={props.ariaLabel}
      class={clsx(
        styles.track,
        props.value && styles.trackOn,
        props.disabled && styles.disabled,
      )}
      style={props.color ? { "--toggle-on-color": props.color } : undefined}
    >
      <input
        id={props.id}
        type="checkbox"
        class={styles.input}
        checked={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange?.(event.currentTarget.checked)}
      />
      <span ref={knob.ref} class={styles.circle} style={knob.style} />
    </label>
  );
}
