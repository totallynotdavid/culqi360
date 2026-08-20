import { clsx } from "clsx";
import { createEffect, Show, splitProps } from "solid-js";
import { type JSX } from "@solidjs/web";

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
  const [local, others] = splitProps(props, [
    "class",
    "label",
    "checked",
    "indeterminate",
    "size",
    "hoverable",
    "disabled",
  ]);

  const isOn = () => Boolean(local.checked) || Boolean(local.indeterminate);
  const hoverable = () => local.hoverable ?? true;

  createEffect(() => {
    if (input) {
      input.indeterminate = Boolean(local.indeterminate);
    }
  });

  return (
    <label
      class={clsx(
        styles.checkboxRoot,
        local.size === "large" ? styles.checkboxLarge : styles.checkboxSmall,
        hoverable() && styles.checkboxHoverable,
        isOn() && styles.checkboxOn,
        local.disabled && styles.checkboxDisabled,
        local.class,
      )}
    >
      <input
        type="checkbox"
        class={styles.checkboxInput}
        checked={local.checked}
        disabled={local.disabled}
        {...others}
        ref={(element) => (input = element)}
      />
      <span class={styles.checkboxBox}>
        <Show when={isOn()}>
          {local.indeterminate ? (
            <Minus class={styles.checkboxIcon} />
          ) : (
            <Check class={styles.checkboxIcon} />
          )}
        </Show>
      </span>
      <Show when={local.label}>
        <span class={styles.checkboxText}>{local.label}</span>
      </Show>
    </label>
  );
}
