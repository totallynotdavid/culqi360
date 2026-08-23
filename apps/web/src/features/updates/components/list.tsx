import type { JSX } from "@solidjs/web";

import styles from "./styles/layout.module.css";

export function UpdatesList(props: { children: JSX.Element }) {
  return (
    <section class={styles.root} aria-label="Actualizaciones">
      {props.children}
    </section>
  );
}

export function UpdatesEmptyMessage(props: { children: JSX.Element }) {
  return <p class={styles.empty}>{props.children}</p>;
}
