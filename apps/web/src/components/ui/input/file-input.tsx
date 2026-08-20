import { clsx } from "clsx";
import { createUniqueId, splitProps } from "solid-js";
import { type JSX } from "@solidjs/web";

import { InputErrorHelper } from "./input-error-helper";
import { InputLabel } from "./input-label";

import styles from "./field.module.css";

export interface FileInputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function FileInput(props: FileInputProps) {
  const [local, others] = splitProps(props, ["label", "error", "class", "id"]);
  const inputId = local.id || createUniqueId();

  return (
    <div class={styles.field}>
      {local.label && (
        <InputLabel for={inputId}>
          {local.label}
          {props.required && <span class={styles.required}>*</span>}
        </InputLabel>
      )}
      <input
        id={inputId}
        type="file"
        class={clsx(
          styles.fileControl,
          local.error ? styles.errorControl : undefined,
          local.class,
        )}
        {...others}
      />
      {local.error && <InputErrorHelper>{local.error}</InputErrorHelper>}
    </div>
  );
}
