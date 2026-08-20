import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { Show } from "solid-js";

import { AnchoredPopover } from "~/components/ui/overlay/anchored-popover";

import menuStyles from "../styles/menu.module.css";
import styles from "../styles/toolbar.module.css";

export function RecordIndexToolbarMenu(props: {
  active?: boolean;
  children: JSX.Element;
  label: string;
  menuId: string;
  onDismiss: () => void;
  onToggle: () => void;
  open: boolean;
  wide?: boolean;
}) {
  let trigger: HTMLButtonElement | undefined;

  return (
    <div class={menuStyles.menuWrap}>
      <button
        ref={(element) => (trigger = element)}
        type="button"
        class={styles.toolbarButton}
        aria-controls={props.menuId}
        aria-expanded={props.open ? "true" : "false"}
        aria-haspopup="dialog"
        data-active={props.active ? "true" : "false"}
        data-open={props.open ? "true" : "false"}
        onClick={props.onToggle}
      >
        {props.label}
      </button>
      <Show when={props.open ? trigger : undefined} keyed>
        {(anchor) => (
          <AnchoredPopover
            id={props.menuId}
            anchor={anchor}
            class={clsx(
              menuStyles.menu,
              menuStyles.menuFloating,
              props.wide && menuStyles.menuWide,
            )}
            onClose={props.onDismiss}
            placement="bottom-end"
            variant="positioner"
          >
            <div role="dialog" aria-label={props.label}>
              {props.children}
            </div>
          </AnchoredPopover>
        )}
      </Show>
    </div>
  );
}
