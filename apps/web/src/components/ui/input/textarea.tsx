import { clsx } from "clsx";
import { createUniqueId, splitProps } from "solid-js";
import { type JSX } from "@solidjs/web";

import { InputErrorHelper } from "./input-error-helper";
import { InputLabel } from "./input-label";

import styles from "./field.module.css";

export interface TextareaProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea(props: TextareaProps) {
  const [local, others] = splitProps(props, ["label", "error", "class", "id"]);
  const generatedId = createUniqueId();
  const textareaId = () => local.id || generatedId;

  return (
    <div class={styles.field}>
      {local.label && (
        <InputLabel for={textareaId()}>
          {local.label}
          {props.required && <span class={styles.required}>*</span>}
        </InputLabel>
      )}
      <textarea
        id={textareaId()}
        class={clsx(
          styles.textareaControl,
          local.error ? styles.errorControl : undefined,
          local.class,
        )}
        {...others}
      />
      {local.error && <InputErrorHelper>{local.error}</InputErrorHelper>}
    </div>
  );
}
