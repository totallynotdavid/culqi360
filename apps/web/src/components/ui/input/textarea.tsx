import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { createUniqueId, omit } from "solid-js";

import { InputErrorHelper } from "./input-error-helper";
import { InputLabel } from "./input-label";

import styles from "./field.module.css";

export interface TextareaProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea(props: TextareaProps) {
  const others = omit(props, "label", "error", "class", "id");
  const generatedId = createUniqueId();
  const textareaId = () => props.id || generatedId;

  return (
    <div class={styles.field}>
      {props.label && (
        <InputLabel for={textareaId()}>
          {props.label}
          {props.required && <span class={styles.required}>*</span>}
        </InputLabel>
      )}
      <textarea
        id={textareaId()}
        class={clsx(
          styles.textareaControl,
          props.error ? styles.errorControl : undefined,
          props.class,
        )}
        {...others}
      />
      {props.error && <InputErrorHelper>{props.error}</InputErrorHelper>}
    </div>
  );
}
