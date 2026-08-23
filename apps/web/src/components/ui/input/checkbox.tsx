import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { createEffect, Show, omit } from "solid-js";

import Check from "~/components/icons/check";
import Minus from "~/components/icons/minus";

import styles from "./field.module.css";

export interface CheckboxProps extends Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> {
  label?: string;
  indeterminate?: boolean;
  size?: "small" | "large";
  hoverable?: boolean;
}

export function Checkbox(props: CheckboxProps) {
  let input: HTMLInputElement | undefined;
  const others = omit(
    props,
    "class",
    "label",
    "checked",
    "indeterminate",
    "size",
    "hoverable",
    "disabled",
  );

  const isOn = () => Boolean(props.checked) || Boolean(props.indeterminate);
  const hoverable = () => props.hoverable ?? true;

  createEffect(
    () => Boolean(props.indeterminate),
    (indeterminate) => {
      if (input) {
        input.indeterminate = indeterminate;
      }
    },
  );

  return (
    <label
      class={clsx(
        styles.checkboxRoot,
        props.size === "large" ? styles.checkboxLarge : styles.checkboxSmall,
        hoverable() && styles.checkboxHoverable,
        isOn() && styles.checkboxOn,
        props.disabled && styles.checkboxDisabled,
        props.class,
      )}
    >
      <input
        type="checkbox"
        class={styles.checkboxInput}
        checked={props.checked}
        disabled={props.disabled}
        {...others}
        ref={(element) => (input = element)}
      />
      <span class={styles.checkboxBox}>
        <Show when={isOn()}>
          {props.indeterminate ? (
            <Minus class={styles.checkboxIcon} />
          ) : (
            <Check class={styles.checkboxIcon} />
          )}
        </Show>
      </span>
      <Show when={props.label}>
        <span class={styles.checkboxText}>{props.label}</span>
      </Show>
    </label>
  );
}
