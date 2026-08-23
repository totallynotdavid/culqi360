import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { Show, children } from "solid-js";

import { OverflowingText } from "~/components/ui/overflow-tooltip/overflow-tooltip";

import styles from "./styles.module.css";

type MenuItemAccent = "default" | "danger" | "placeholder";

type MenuItemProps = {
  text: string;
  contextualText?: string;
  leftComponent?: JSX.Element;
  rightComponent?: JSX.Element;
  accent?: MenuItemAccent;
  focused?: boolean;
  disabled?: boolean;
  class?: string;
  onClick?: () => void;
  onHighlight?: () => void;
};

export function MenuItem(props: MenuItemProps) {
  const leftComponent = children(() => props.leftComponent);
  const rightComponent = children(() => props.rightComponent);

  return (
    <button
      type="button"
      class={clsx(styles.root, props.class)}
      // Keep the accessible name complete when visible text is truncated.
      aria-label={
        props.contextualText
          ? `${props.text}, ${props.contextualText}`
          : props.text
      }
      data-accent={props.accent ?? "default"}
      data-focused={props.focused ? "" : undefined}
      disabled={props.disabled}
      onClick={() => props.onClick?.()}
      onMouseEnter={() => props.onHighlight?.()}
      onFocus={() => props.onHighlight?.()}
    >
      <span class={styles.leftContent}>
        <Show when={leftComponent()}>{leftComponent()}</Show>

        <span class={styles.label}>
          <span class={styles.mainText}>
            <OverflowingText text={props.text} />
          </span>

          <Show when={props.contextualText}>
            {(contextualText) => (
              <span class={styles.contextualText}>
                <OverflowingText text={`· ${contextualText()}`} />
              </span>
            )}
          </Show>
        </span>
      </span>

      <Show when={rightComponent()}>
        <span class={styles.rightContent}>{rightComponent()}</span>
      </Show>
    </button>
  );
}
