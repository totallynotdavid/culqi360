import { createMotion } from "@crm/solid-motion";
import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { type ParentProps } from "solid-js";

import { CONTROL_SPRING } from "~/components/ui/animation/springs";

import styles from "./radio.module.css";

export function RadioGroup(props: ParentProps) {
  return <div class={styles.group}>{props.children}</div>;
}

export function Radio(props: {
  checked?: boolean;
  disabled?: boolean;
  label?: string;
  name?: string;
  value?: string;
  onChange?: JSX.ChangeEventHandlerUnion<HTMLInputElement, Event>;
}) {
  const scale = () => (props.checked ? 1.05 : 0.95);
  const dot = createMotion(() => ({
    initial: { scale: scale() },
    animate: { scale: scale() },
    transition: CONTROL_SPRING,
  }));

  return (
    <label class={clsx(styles.container, props.disabled && styles.disabled)}>
      <input
        ref={dot.ref}
        type="radio"
        class={styles.input}
        style={dot.style}
        name={props.name}
        value={props.value ?? props.label}
        checked={props.checked}
        disabled={props.disabled}
        onChange={props.onChange}
      />
      {props.label && <span class={styles.label}>{props.label}</span>}
    </label>
  );
}
