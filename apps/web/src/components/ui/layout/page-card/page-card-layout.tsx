import { type JSX } from "@solidjs/web";
import { Show, children, type ParentProps } from "solid-js";

import styles from "./page-card-layout.module.css";

interface PageCardLayoutProps extends ParentProps {
  header?: JSX.Element;
  secondaryBar?: JSX.Element;
}

export function PageCardLayout(props: PageCardLayoutProps) {
  // Resolve the header before the conditional slot so both runtimes allocate
  // hydration ids in the same order. The server defers an inline
  // `{props.header}` expression until after `<Show>` is built, while the
  // browser evaluates it first.
  const header = children(() => props.header);
  const secondaryBar = children(() => props.secondaryBar);

  return (
    <div class={styles.root}>
      <div class={styles.cardWrapper}>
        <div class={styles.card}>
          {header()}
          <Show when={secondaryBar()}>{secondaryBar()}</Show>
          <div class={styles.bodyContent}>{props.children}</div>
        </div>
      </div>
    </div>
  );
}
