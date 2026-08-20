import type { JSX } from "@solidjs/web";
import { clsx } from "clsx";

import styles from "./field.module.css";

type InputHintProps = JSX.HTMLAttributes<HTMLDivElement> & {
  danger?: boolean;
};

export function InputHint(props: InputHintProps) {
  return (
    <div
      {...props}
      class={clsx(
        styles.hintText,
        props.danger ? styles.hintTextDanger : undefined,
        props.class,
      )}
    />
  );
}
