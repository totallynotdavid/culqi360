import { type JSX } from "@solidjs/web";
import { children, Show, type ParentProps } from "solid-js";

import styles from "./styles.module.css";

export function SidePanelPage(props: ParentProps<{ footer?: JSX.Element }>) {
  const footer = children(() => props.footer);

  return (
    <div class={styles.page}>
      <div class={styles.scroll}>{props.children}</div>
      <Show when={footer()}>{footer()}</Show>
    </div>
  );
}
