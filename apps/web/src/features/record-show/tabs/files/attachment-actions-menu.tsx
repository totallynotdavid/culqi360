import { Portal } from "@solidjs/web";
import { Show, createEffect, createSignal, onSettled } from "solid-js";

import { Button } from "~/components/ui/input/button";
import type { LeadSaleProofFileView } from "~/contracts/workflow/results";

import styles from "./files.module.css";

type AttachmentActionsMenuProps = {
  file: LeadSaleProofFileView;
  onPreview?: (file: LeadSaleProofFileView) => Promise<void> | void;
  onDownload: (fileId: string) => Promise<void> | void;
};

export function AttachmentActionsMenu(props: AttachmentActionsMenuProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  const [menuPosition, setMenuPosition] = createSignal({ top: 0, left: 0 });
  let rootRef: HTMLDivElement | undefined;
  let triggerRef: HTMLButtonElement | undefined;
  let menuRef: HTMLDivElement | undefined;

  function updateMenuPosition() {
    if (!triggerRef) {
      return;
    }
    const rect = triggerRef.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 4,
      left: rect.right,
    });
  }

  onSettled(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!isOpen()) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (rootRef?.contains(target) || menuRef?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    window.document.addEventListener("pointerdown", handlePointerDown);
    return () =>
      window.document.removeEventListener("pointerdown", handlePointerDown);
  });

  createEffect(
    () => isOpen(),
    (open) => {
      if (!open) {
        return;
      }

      updateMenuPosition();

      const handleViewportChange = () => updateMenuPosition();

      window.addEventListener("resize", handleViewportChange);
      window.addEventListener("scroll", handleViewportChange, true);

      return () => {
        window.removeEventListener("resize", handleViewportChange);
        window.removeEventListener("scroll", handleViewportChange, true);
      };
    },
  );

  return (
    <div class={styles.actionsMenuRoot} ref={(el) => (rootRef = el)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class={styles.actionsMenuTrigger}
        aria-haspopup="menu"
        aria-expanded={isOpen() ? "true" : "false"}
        aria-label="Acciones de archivo"
        ref={(el) => (triggerRef = el)}
        onClick={() => {
          const next = !isOpen();
          setIsOpen(next);
          if (next) {
            updateMenuPosition();
          }
        }}
      >
        ...
      </Button>
      <Show when={isOpen()}>
        <Portal>
          <div
            class={styles.actionsMenu}
            role="menu"
            ref={(el) => (menuRef = el)}
            style={{
              top: `${menuPosition().top}px`,
              left: `${menuPosition().left}px`,
            }}
          >
            <button
              type="button"
              class={styles.actionsMenuItem}
              role="menuitem"
              disabled={!props.onPreview}
              onClick={() => {
                void props.onPreview?.(props.file);
                setIsOpen(false);
              }}
            >
              Vista previa
            </button>
            <button
              type="button"
              class={styles.actionsMenuItem}
              role="menuitem"
              disabled={props.file.status !== "ready"}
              onClick={() => {
                void props.onDownload(props.file.fileId);
                setIsOpen(false);
              }}
            >
              Descargar
            </button>
          </div>
        </Portal>
      </Show>
    </div>
  );
}
