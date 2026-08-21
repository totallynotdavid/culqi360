import { Portal } from "@solidjs/web";
import { For, Show, createSignal, onSettled, type Component } from "solid-js";

import { trackViewportAnchor } from "~/browser/dom/track-viewport-anchor";
import DotsVertical from "~/components/icons/dots-vertical";
import { TopBarActionButton } from "~/components/layout/top-bar-action-button";
import { TopBarTooltip } from "~/components/layout/top-bar-tooltip";

import styles from "./record-show-actions-menu.module.css";

export type RecordShowMenuItem = {
  id: string;
  label: string;
  icon: Component<{ size?: number }>;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

type RecordShowActionsMenuProps = {
  items: RecordShowMenuItem[];
};

export function RecordShowActionsMenu(props: RecordShowActionsMenuProps) {
  const [open, setOpen] = createSignal(false);
  const [menuPosition, setMenuPosition] = createSignal({ top: 0, left: 0 });

  let rootRef: HTMLDivElement | undefined;
  let menuRef: HTMLDivElement | undefined;

  function updateMenuPosition() {
    if (!rootRef) {
      return;
    }

    const rect = rootRef.getBoundingClientRect();

    setMenuPosition({
      top: rect.bottom + 4,
      left: rect.right,
    });
  }

  function toggleMenu() {
    const nextOpen = !open();

    setOpen(nextOpen);

    if (nextOpen) {
      updateMenuPosition();
    }
  }

  onSettled(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!open()) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }
      if (rootRef?.contains(target) || menuRef?.contains(target)) {
        return;
      }

      setOpen(false);
    };

    window.document.addEventListener("pointerdown", handlePointerDown);

    return () =>
      window.document.removeEventListener("pointerdown", handlePointerDown);
  });

  trackViewportAnchor(open, updateMenuPosition);

  return (
    <Show when={props.items.length > 0}>
      <div class={styles.root} ref={(el) => (rootRef = el)}>
        <TopBarTooltip content="Más opciones">
          <TopBarActionButton
            ariaLabel="Más opciones"
            iconOnly
            pressed={open()}
            onClick={toggleMenu}
          >
            <DotsVertical size={16} />
          </TopBarActionButton>
        </TopBarTooltip>

        <Show when={open()}>
          <Portal>
            <div
              class={styles.menu}
              role="menu"
              ref={(el) => (menuRef = el)}
              style={{
                top: `${menuPosition().top}px`,
                left: `${menuPosition().left}px`,
              }}
            >
              <For each={props.items}>
                {(item) => (
                  <button
                    type="button"
                    class={[styles.item, item.danger && styles.dangerItem]}
                    role="menuitem"
                    disabled={item.disabled}
                    aria-disabled={item.disabled ? "true" : "false"}
                    onClick={() => {
                      if (item.disabled) {
                        return;
                      }

                      setOpen(false);
                      item.onSelect();
                    }}
                  >
                    <item.icon size={14} />
                    <span>{item.label}</span>
                  </button>
                )}
              </For>
            </div>
          </Portal>
        </Show>
      </div>
    </Show>
  );
}
