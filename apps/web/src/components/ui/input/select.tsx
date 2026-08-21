import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { createUniqueId, omit } from "solid-js";

import { InputErrorHelper } from "./input-error-helper";
import { InputLabel } from "./input-label";

import styles from "./field.module.css";

export interface SelectProps extends JSX.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select(props: SelectProps) {
  const others = omit(props, "label", "error", "class", "id", "children");
  const generatedId = createUniqueId();
  const selectId = () => props.id || generatedId;

  return (
    <div class={styles.field}>
      {props.label && (
        <InputLabel for={selectId()}>
          {props.label}
          {props.required && (
            <span aria-hidden="true" class={styles.required}>
              *
            </span>
          )}
        </InputLabel>
      )}
      <select
        id={selectId()}
        class={clsx(
          styles.control,
          props.error ? styles.errorControl : undefined,
          props.class,
        )}
        {...others}
      >
        {props.children}
      </select>
      {props.error && <InputErrorHelper>{props.error}</InputErrorHelper>}
    </div>
  );
}
