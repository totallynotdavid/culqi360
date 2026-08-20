import { type JSX } from "@solidjs/web";
import { Show, children, type ParentProps } from "solid-js";

import styles from "./page-card-layout.module.css";

interface PageCardLayoutProps extends ParentProps {
  header?: JSX.Element;
  secondaryBar?: JSX.Element;
}

export function PageCardLayout(props: PageCardLayoutProps) {
  const secondaryBar = children(() => props.secondaryBar);

  return (
    <div class={styles.root}>
      <div class={styles.cardWrapper}>
        <div class={styles.card}>
          {props.header}
          <Show when={secondaryBar()}>{secondaryBar()}</Show>
          <div class={styles.bodyContent}>{props.children}</div>
        </div>
      </div>
    </div>
  );
}
