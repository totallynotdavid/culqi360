import { type JSX } from "@solidjs/web";
import { Portal } from "@solidjs/web";
import { clsx } from "clsx";
import { createEffect, onSettled, type Accessor } from "solid-js";

import styles from "./anchored-popover.module.css";

const VIEWPORT_PADDING = 8;

type Anchor = HTMLElement | Accessor<HTMLElement | undefined>;

export function AnchoredPopover(props: {
  id?: string;
  anchor: Anchor;
  children: JSX.Element;
  class?: string;
  dismissible?: boolean;
  matchAnchorWidth?: boolean;
  onClose?: () => void;
  placement?: "bottom-start" | "bottom-end" | "overlap" | "left-start";
  offset?: number;
  variant?: "panel" | "positioner";
}) {
  let panel: HTMLDivElement | undefined;

  const anchor = () =>
    typeof props.anchor === "function" ? props.anchor() : props.anchor;

  function clampToViewport(value: number, size: number, viewport: number) {
    return Math.max(
      VIEWPORT_PADDING,
      Math.min(value, viewport - size - VIEWPORT_PADDING),
    );
  }

  function updatePosition() {
    const anchorElement = anchor();

    if (!panel || !anchorElement) {
      return;
    }

    const rect = anchorElement.getBoundingClientRect();
    const placement = props.placement ?? "bottom-start";

    // Side placement clamps in place; bottom placements flip above if needed.
    if (placement === "left-start") {
      const offset = props.offset ?? 0;

      panel.style.left = `${clampToViewport(
        rect.left - panel.offsetWidth - offset,
        panel.offsetWidth,
        window.innerWidth,
      )}px`;

      panel.style.top = `${clampToViewport(
        rect.top,
        panel.offsetHeight,
        window.innerHeight,
      )}px`;

      panel.style.minWidth = props.matchAnchorWidth ? `${rect.width}px` : "";

      return;
    }

    const preferredLeft =
      placement === "bottom-end" ? rect.right - panel.offsetWidth : rect.left;

    const left = clampToViewport(
      preferredLeft,
      panel.offsetWidth,
      window.innerWidth,
    );

    const preferredTop = placement === "overlap" ? rect.top : rect.bottom;

    const top =
      preferredTop + panel.offsetHeight + VIEWPORT_PADDING > window.innerHeight
        ? Math.max(VIEWPORT_PADDING, rect.top - panel.offsetHeight)
        : preferredTop;

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.minWidth = props.matchAnchorWidth ? `${rect.width}px` : "";
  }

  onSettled(() => {
    if (!panel) {
      return;
    }

    const currentPanel = panel;

    const handleToggle = (event: ToggleEvent) => {
      if (event.newState === "closed") {
        props.onClose?.();
      }
    };

    if (props.dismissible !== false) {
      currentPanel.addEventListener("toggle", handleToggle);
      currentPanel.showPopover();

      queueMicrotask(() =>
        currentPanel.querySelector<HTMLElement>("[autofocus]")?.focus(),
      );
    }

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      currentPanel.removeEventListener("toggle", handleToggle);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);

      if (props.dismissible !== false) {
        anchor()?.focus();
      }
    };
  });

  createEffect(anchor, (anchorElement) => {
    updatePosition();

    if (!panel || !anchorElement) {
      return;
    }

    const observer = new ResizeObserver(updatePosition);

    observer.observe(panel);
    observer.observe(anchorElement);

    return () => observer.disconnect();
  });

  return (
    <Portal>
      <div
        ref={(element) => (panel = element)}
        id={props.id}
        class={clsx(
          props.variant === "positioner" ? styles.positioner : styles.panel,
          props.class,
        )}
        popover={props.dismissible === false ? undefined : "auto"}
      >
        {props.children}
      </div>
    </Portal>
  );
}
