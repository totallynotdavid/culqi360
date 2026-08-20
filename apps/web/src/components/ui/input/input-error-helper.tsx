import type { JSX } from "@solidjs/web";

import styles from "./field.module.css";

export function InputErrorHelper(props: JSX.HTMLAttributes<HTMLDivElement>) {
  return (
    <div class={styles.errorHelperWrap}>
      <div {...props} class={styles.errorText} aria-live="polite" />
    </div>
  );
}
