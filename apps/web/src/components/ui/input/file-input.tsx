import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { createUniqueId, omit } from "solid-js";

import { InputErrorHelper } from "./input-error-helper";
import { InputLabel } from "./input-label";

import styles from "./field.module.css";

export interface FileInputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function FileInput(props: FileInputProps) {
  const others = omit(props, "label", "error", "class", "id");
  const inputId = props.id || createUniqueId();

  return (
    <div class={styles.field}>
      {props.label && (
        <InputLabel for={inputId}>
          {props.label}
          {props.required && <span class={styles.required}>*</span>}
        </InputLabel>
      )}
      <input
        id={inputId}
        type="file"
        class={clsx(
          styles.fileControl,
          props.error ? styles.errorControl : undefined,
          props.class,
        )}
        {...others}
      />
      {props.error && <InputErrorHelper>{props.error}</InputErrorHelper>}
    </div>
  );
}
