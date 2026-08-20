import type { JSX } from "@solidjs/web";

import { ScrollWrapper } from "~/components/ui/utilities/scroll-wrapper";

import styles from "./widget-layout.module.css";

export type WidgetSpan = "quarter" | "half" | "full";

export function WidgetCanvas(props: { children: JSX.Element }) {
  return (
    <div class={styles.canvas}>
      <ScrollWrapper>
        <div class={styles.canvasContent}>{props.children}</div>
      </ScrollWrapper>
    </div>
  );
}

export function WidgetGrid(props: { children: JSX.Element }) {
  return <div class={styles.grid}>{props.children}</div>;
}

export function WidgetGridItem(props: {
  span: WidgetSpan;
  children: JSX.Element;
}) {
  return <div class={[styles.item, styles[props.span]]}>{props.children}</div>;
}

export function WidgetStack(props: { children: JSX.Element }) {
  return <div class={styles.stack}>{props.children}</div>;
}
