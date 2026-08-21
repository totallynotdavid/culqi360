import { type JSX } from "@solidjs/web";
import { Show } from "solid-js";

import styles from "./top-bar-tooltip.module.css";

interface TopBarTooltipProps {
  children: JSX.Element;
  content?: string;
  align?: "center" | "end";
}

export function TopBarTooltip(props: TopBarTooltipProps) {
  return (
    <div class={`${styles.anchor} ${props.align === "end" ? styles.end : ""}`}>
      {props.children}
      <Show when={props.content}>
        <div class={styles.tooltip} role="tooltip">
          {props.content}
        </div>
      </Show>
    </div>
  );
}
