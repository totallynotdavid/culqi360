import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { Show, onSettled } from "solid-js";

import {
  SIDE_PANEL_CLICK_OUTSIDE_ID,
  SIDE_PANEL_EXCLUDED_CLICK_OUTSIDE_IDS,
} from "../constants/side-panel-click-outside-id";
import { useSidePanel } from "../state/use-side-panel";

import styles from "./shell.module.css";

type PanelShellProps = {
  renderContent?: () => JSX.Element;
  isInteractive?: boolean;
  shouldRenderChildren?: boolean;
  isResizing: boolean;
};

export function PanelShell(props: PanelShellProps) {
  const { isOpen, isClosing, closePanel, onCloseAnimationComplete } =
    useSidePanel();

  function handleTransitionEnd(event: TransitionEvent) {
    if (event.propertyName === "width" && !isOpen() && isClosing()) {
      onCloseAnimationComplete();
    }
  }

  onSettled(() => {
    function handlePointerDown(e: PointerEvent) {
      if (props.isInteractive === false) {
        return;
      }
      if (!isOpen()) {
        return;
      }
      const path = e.composedPath();
      const isExcluded = path.some((el) => {
        if (!(el instanceof Element)) {
          return false;
        }
        // A data-grid row is the panel's own navigator: clicking another record
        // swaps the panel content in place, so it must not count as "outside"
        // (otherwise the panel closes and immediately reopens).
        if (el.hasAttribute("data-grid-row-id")) {
          return true;
        }
        const id = el.getAttribute("data-click-outside-id");
        return (
          id !== null && SIDE_PANEL_EXCLUDED_CLICK_OUTSIDE_IDS.includes(id)
        );
      });
      if (!isExcluded) {
        closePanel();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  });

  return (
    <div
      class={clsx(
        styles.wrapper,
        isOpen() && styles.wrapperOpen,
        props.isResizing && styles.wrapperResizing,
      )}
      data-side-panel=""
      data-click-outside-id={SIDE_PANEL_CLICK_OUTSIDE_ID}
      onTransitionEnd={handleTransitionEnd}
    >
      <aside class={styles.aside}>
        <Show
          when={
            props.shouldRenderChildren !== false && (isOpen() || isClosing())
          }
        >
          {props.renderContent?.()}
        </Show>
      </aside>
    </div>
  );
}
