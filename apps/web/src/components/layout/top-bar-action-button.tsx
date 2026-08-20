import { A } from "@solidjs/router";
import { clsx } from "clsx";
import { Show, splitProps } from "solid-js";
import { type JSX } from "@solidjs/web";

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
  const [local] = splitProps(props, [
    "ariaLabel",
    "children",
    "label",
    "hotkeys",
    "iconOnly",
    "href",
    "onClick",
    "type",
    "class",
    "buttonClass",
    "disabled",
    "pressed",
    "dataTestId",
    "dataClickOutsideId",
  ]);

  const content = (
    <>
      <span class={styles.iconSlot}>{local.children}</span>
      <Show when={local.label || local.hotkeys}>
        <span class={styles.text}>
          <Show when={local.label}>
            <span class={styles.label}>{local.label}</span>
          </Show>
          <Show when={local.hotkeys}>
            <span class={styles.separator} aria-hidden="true" />
            <span class={styles.hotkeys}>{local.hotkeys}</span>
          </Show>
        </span>
      </Show>
    </>
  );

  return (
    <div class={clsx(styles.root, local.class)}>
      <Show
        when={local.href}
        fallback={
          <button
            type={local.type ?? "button"}
            class={clsx(
              styles.control,
              local.iconOnly && styles.iconOnly,
              local.buttonClass,
            )}
            onClick={local.onClick}
            disabled={local.disabled}
            aria-label={local.ariaLabel}
            aria-pressed={local.pressed}
            data-testid={local.dataTestId}
            data-click-outside-id={local.dataClickOutsideId}
          >
            {content}
          </button>
        }
      >
        {(href) => (
          <A
            href={href()}
            class={clsx(
              styles.control,
              local.iconOnly && styles.iconOnly,
              local.buttonClass,
            )}
            onClick={local.onClick}
            aria-label={local.ariaLabel}
            aria-disabled={local.disabled ? "true" : undefined}
            data-testid={local.dataTestId}
            data-click-outside-id={local.dataClickOutsideId}
          >
            {content}
          </A>
        )}
      </Show>
    </div>
  );
}
