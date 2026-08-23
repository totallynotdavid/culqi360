import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { merge, omit } from "solid-js";

import styles from "./text-input.module.css";

export type TextInputSize = "xs" | "sm" | "md" | "lg";

export type TextInputProps = Omit<
  JSX.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "size"
> & {
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
  sizeVariant?: TextInputSize;
  inheritFontStyles?: boolean;
};

const SIZE_CLASS: Record<TextInputSize, string> = {
  xs: styles.sizeXs,
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

export function TextInput(props: TextInputProps) {
  const withDefaults = merge({ sizeVariant: "lg" as const }, props);
  const native = omit(
    withDefaults,
    "class",
    "onChange",
    "error",
    "sizeVariant",
    "inheritFontStyles",
  );

  return (
    <input
      class={clsx(
        styles.input,
        SIZE_CLASS[withDefaults.sizeVariant],
        withDefaults.inheritFontStyles && styles.inheritFont,
        withDefaults.error && styles.inputError,
        withDefaults.class,
      )}
      onInput={(e) => withDefaults.onChange?.(e.currentTarget.value)}
      {...native}
    />
  );
}
