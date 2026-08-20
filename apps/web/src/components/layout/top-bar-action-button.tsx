import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { Show } from "solid-js";

import styles from "./top-bar-action-button.module.css";

interface TopBarActionButtonProps {
  ariaLabel: string;
  children: JSX.Element;
  label?: string;
  hotkeys?: string;
  iconOnly?: boolean;
  href?: string;
  onClick?: JSX.EventHandlerUnion<HTMLElement, MouseEvent>;
  type?: "button" | "submit" | "reset";
  class?: string;
  buttonClass?: string;
  disabled?: boolean;
  pressed?: boolean;
  dataTestId?: string;
  dataClickOutsideId?: string;
}

export function TopBarActionButton(props: TopBarActionButtonProps) {
  const content = (
    <>
      <span class={styles.iconSlot}>{props.children}</span>
      <Show when={props.label || props.hotkeys}>
        <span class={styles.text}>
          <Show when={props.label}>
            <span class={styles.label}>{props.label}</span>
          </Show>
          <Show when={props.hotkeys}>
            <span class={styles.separator} aria-hidden="true" />
            <span class={styles.hotkeys}>{props.hotkeys}</span>
          </Show>
        </span>
      </Show>
    </>
  );

  return (
    <div class={clsx(styles.root, props.class)}>
      <Show
        when={props.href}
        fallback={
          <button
            type={props.type ?? "button"}
            class={clsx(
              styles.control,
              props.iconOnly && styles.iconOnly,
              props.buttonClass,
            )}
            onClick={props.onClick}
            disabled={props.disabled}
            aria-label={props.ariaLabel}
            aria-pressed={props.pressed ? "true" : "false"}
            data-testid={props.dataTestId}
            data-click-outside-id={props.dataClickOutsideId}
          >
            {content}
          </button>
        }
      >
        {(href) => (
          <a
            href={href()}
            class={clsx(
              styles.control,
              props.iconOnly && styles.iconOnly,
              props.buttonClass,
            )}
            onClick={props.onClick}
            aria-label={props.ariaLabel}
            aria-disabled={props.disabled ? "true" : undefined}
            data-testid={props.dataTestId}
            data-click-outside-id={props.dataClickOutsideId}
          >
            {content}
          </a>
        )}
      </Show>
    </div>
  );
}
