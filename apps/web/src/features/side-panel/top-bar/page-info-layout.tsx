import type { JSX } from "@solidjs/web";
import { children, Show } from "solid-js";

import styles from "./page-info-layout.module.css";

type PageInfoLayoutProps = {
  icon?: JSX.Element;
  iconColor?: string;
  title: JSX.Element;
  badge?: JSX.Element;
  label?: string;
};

export function PageInfoLayout(props: PageInfoLayoutProps) {
  const icon = children(() => props.icon);
  const badge = children(() => props.badge);

  return (
    <div class={styles.container}>
      <Show when={icon()}>
        <div class={styles.iconWrapper} style={{ color: props.iconColor }}>
          {icon()}
        </div>
      </Show>
      <div class={styles.textContainer}>
        <div class={styles.titleWrapper}>{props.title}</div>
        <Show when={badge()}>
          <span class={styles.badge}>{badge()}</span>
        </Show>
        <Show when={props.label}>
          <span class={styles.label}>{props.label}</span>
        </Show>
      </div>
    </div>
  );
}
