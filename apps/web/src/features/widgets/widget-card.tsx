import { Show, type ParentProps } from "solid-js";

import { OverflowingText } from "~/components/ui/overflow-tooltip/overflow-tooltip";

import styles from "./widget-card.module.css";

export type WidgetCardVariant = "dashboard" | "record-page" | "side-column";

export function WidgetCard(
  props: ParentProps<{ variant?: WidgetCardVariant; class?: string }>,
) {
  return (
    <div
      class={`${styles.card} ${props.class ?? ""}`}
      data-variant={props.variant ?? "record-page"}
    >
      {props.children}
    </div>
  );
}

export function WidgetCardHeader(props: ParentProps<{ class?: string }>) {
  return (
    <div class={`${styles.header} ${props.class ?? ""}`}>{props.children}</div>
  );
}

export function WidgetCardTitle(props: { text: string; count?: number }) {
  return (
    <div class={styles.title}>
      <OverflowingText text={props.text} style={{ width: "100%" }} />
      <Show when={props.count !== undefined}>
        <span class={styles.count}>{props.count}</span>
      </Show>
    </div>
  );
}

export function WidgetCardHeaderActions(props: ParentProps) {
  return (
    <div class={styles.rightContainer}>
      <div class={styles.actionsContainer}>{props.children}</div>
    </div>
  );
}

export function WidgetCardContent(props: ParentProps<{ class?: string }>) {
  return (
    <div class={`${styles.content} ${props.class ?? ""}`}>{props.children}</div>
  );
}

export function WidgetCardActions(
  props: ParentProps<{
    align?: "start" | "end";
    class?: string;
    stack?: boolean;
  }>,
) {
  return (
    <div
      class={[
        styles.actions,
        props.align === "start" && styles.actionsStart,
        props.stack && styles.actionsStack,
        props.class,
      ]}
    >
      {props.children}
    </div>
  );
}

export function WidgetCardSubsectionHeader(
  props: ParentProps & { onClick?: () => void },
) {
  return (
    <button
      type="button"
      class={styles.subsectionHeader}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

export function WidgetCardSubsectionChevron(
  props: ParentProps<{ isExpanded: boolean }>,
) {
  return (
    <div
      class={`${styles.subsectionChevron} ${
        props.isExpanded ? styles.subsectionChevronExpanded : ""
      }`}
    >
      {props.children}
    </div>
  );
}
