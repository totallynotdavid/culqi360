import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { createSignal, createUniqueId, Show, omit } from "solid-js";

import { InputErrorHelper } from "./input-error-helper";
import { InputHint } from "./input-hint";
import { InputLabel } from "./input-label";

import styles from "./field.module.css";

export interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  noErrorHelper?: boolean;
}

export function Input(props: InputProps) {
  const others = omit(
    props,
    "label",
    "error",
    "hint",
    "noErrorHelper",
    "class",
    "id",
    "type",
  );
  const generatedId = createUniqueId();
  const inputId = () => props.id || generatedId;
  const errorId = () => `${inputId()}-error`;
  const hintId = () => `${inputId()}-hint`;
  const describedBy = () => {
    const existing = others["aria-describedby"];
    const ids = [
      typeof existing === "string" && existing.length > 0 ? existing : null,
      props.error ? errorId() : null,
      !props.error && props.hint ? hintId() : null,
    ].filter((value): value is string => Boolean(value));

    return ids.length > 0 ? ids.join(" ") : undefined;
  };
  const isPassword = () => props.type === "password";
  const [showPassword, setShowPassword] = createSignal(false);

  return (
    <div class={styles.field}>
      {props.label && (
        <InputLabel for={inputId()}>
          {props.label}
          {props.required && (
            <span aria-hidden="true" class={styles.required}>
              *
            </span>
          )}
        </InputLabel>
      )}
      <div class={isPassword() ? styles.inputWrap : undefined}>
        <input
          id={inputId()}
          aria-describedby={describedBy()}
          type={
            isPassword() ? (showPassword() ? "text" : "password") : props.type
          }
          class={clsx(
            styles.control,
            isPassword() ? styles.controlWithReveal : undefined,
            props.error ? styles.errorControl : undefined,
            props.class,
          )}
          {...others}
        />
        <Show when={isPassword()}>
          <button
            type="button"
            class={styles.revealButton}
            aria-label={
              showPassword() ? "Ocultar contraseña" : "Mostrar contraseña"
            }
            aria-pressed={showPassword() ? "true" : "false"}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword() ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </Show>
      </div>
      <Show when={props.hint && !props.error}>
        <InputHint id={hintId()}>{props.hint}</InputHint>
      </Show>
      <Show when={props.error && !props.noErrorHelper}>
        <InputErrorHelper id={errorId()}>{props.error}</InputErrorHelper>
      </Show>
    </div>
  );
}
