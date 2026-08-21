import { type JSX } from "@solidjs/web";
import { onSettled, type Accessor } from "solid-js";

import { AnchoredPopover } from "~/components/ui/overlay/anchored-popover";

import styles from "../styles/table.module.css";

export function DataGridCellEditor(props: {
  anchor: Accessor<HTMLElement | undefined>;
  ariaLabel: string;
  onClose: () => void;
  children: JSX.Element;
}) {
  let editor: HTMLDivElement | undefined;

  // Nothing reactive here: the listener is installed once and reads props
  // when it fires, so this is a mount-time subscription, not an effect.
  onSettled(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (editor && target instanceof Node && !editor.contains(target)) {
        props.onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  });

  return (
    <AnchoredPopover
      anchor={props.anchor}
      class={styles.cellEditor}
      dismissible={false}
      matchAnchorWidth
      onClose={props.onClose}
      placement="overlap"
      variant="positioner"
    >
      <div
        ref={(element) => (editor = element)}
        role="dialog"
        aria-label={props.ariaLabel}
      >
        {props.children}
      </div>
    </AnchoredPopover>
  );
}
