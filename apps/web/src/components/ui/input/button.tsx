import { type JSX } from "@solidjs/web";
import { merge, omit } from "solid-js";

import { Loader } from "~/components/feedback/spinner/loader";

import styles from "./button.module.css";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link";

export type ButtonSize = "sm" | "md" | "lg" | "icon" | "compact";

export type ButtonAccent = "default" | "blue";

const ACCENT_CLASS: Record<ButtonAccent, string | undefined> = {
  default: undefined,
  blue: styles.accentBlue,
};

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  accent?: ButtonAccent;
  loading?: boolean;
}

export function Button(props: ButtonProps) {
  const merged = merge(
    {
      variant: "primary" as const,
      size: "md" as const,
      accent: "default" as const,
    },
    props,
  );
  const others = omit(
    merged,
    "variant",
    "size",
    "accent",
    "class",
    "children",
    "loading",
  );

  return (
    <button
      class={[
        styles.button,
        styles[merged.size],
        styles[merged.variant],
        ACCENT_CLASS[merged.accent],
        merged.class,
      ]}
      data-loading={merged.loading ? "" : undefined}
      disabled={others.disabled || merged.loading}
      {...others}
    >
      <span class={styles.loaderSlot} aria-hidden="true">
        <Loader />
      </span>
      <span class={styles.content}>{merged.children}</span>
    </button>
  );
}
