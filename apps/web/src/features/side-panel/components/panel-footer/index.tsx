import { type JSX } from "@solidjs/web";
import { Portal } from "@solidjs/web";
import { For, Show, createMemo, createSignal, onSettled } from "solid-js";

import { trackViewportAnchor } from "~/browser/dom/track-viewport-anchor";
import { useDismissibleLayer } from "~/components/ui/utilities/use-dismissible-layer";
import { useScopedHotkey } from "~/features/side-panel/core/hotkeys/create-scoped-hotkey";

import styles from "./styles.module.css";

export type FooterOption = {
  id: string;
  label: string;
  icon: (props: { size?: number }) => JSX.Element;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export type FooterPrimary = {
  label: string;
  icon?: JSX.Element;
  // Shown after the platform mod symbol, e.g. "⏎" renders as "⌘ ⏎".
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
};

type SidePanelFooterProps = {
  primary: FooterPrimary;
  options?: FooterOption[];
};

export function SidePanelFooter(props: SidePanelFooterProps) {
  const [isOptionsOpen, setIsOptionsOpen] = createSignal(false);
  const [isMac, setIsMac] = createSignal(false);
  const [menuPosition, setMenuPosition] = createSignal({ left: 0, top: 0 });
  const [rootRef, setRootRef] = createSignal<HTMLDivElement>();
  const [triggerRef, setTriggerRef] = createSignal<HTMLButtonElement>();
  const [menuRef, setMenuRef] = createSignal<HTMLDivElement>();

  const modKey = createMemo(() => (isMac() ? "⌘" : "Ctrl"));
  const hasOptions = createMemo(() => (props.options?.length ?? 0) > 0);

  const closeOptions = () => setIsOptionsOpen(false);

  const toggleOptions = () => {
    if (!hasOptions()) {
      return;
    }
    setIsOptionsOpen((current) => !current);
  };

  const runPrimary = () => {
    if (props.primary.disabled) {
      return;
    }
    props.primary.onClick();
  };

  function updateMenuPosition() {
    const trigger = triggerRef();
    if (!trigger) {
      return;
    }

    const GUTTER = 8;
    const OFFSET = 8;
    const FALLBACK_MENU_WIDTH = 232;
    const rect = trigger.getBoundingClientRect();
    const menu = menuRef();
    const menuWidth = menu?.offsetWidth ?? FALLBACK_MENU_WIDTH;
    const menuHeight = menu?.offsetHeight ?? 0;
    const maxLeft = Math.max(GUTTER, window.innerWidth - menuWidth - GUTTER);
    const left = Math.min(Math.max(rect.right - menuWidth, GUTTER), maxLeft);
    const topAligned = rect.top - menuHeight - OFFSET;
    const top = topAligned < GUTTER ? rect.bottom + OFFSET : topAligned;

    setMenuPosition({ left, top });
  }

  useDismissibleLayer({
    enabled: isOptionsOpen,
    onDismiss: closeOptions,
    getContainer: () => rootRef(),
    getAdditionalContainers: () => [menuRef()],
  });

  onSettled(() => {
    setIsMac(/Mac/i.test(navigator.platform));
  });

  trackViewportAnchor(isOptionsOpen, updateMenuPosition);

  useScopedHotkey("Mod+O", () => toggleOptions(), {
    allowInInputs: true,
    enabled: hasOptions,
  });
  useScopedHotkey("Mod+Enter", () => runPrimary(), { allowInInputs: true });

  return (
    <footer class={styles.footer}>
      <Show when={hasOptions()}>
        <div class={styles.optionsRoot} ref={setRootRef}>
          <button
            type="button"
            class={styles.secondaryButton}
            aria-haspopup="menu"
            aria-expanded={isOptionsOpen() ? "true" : "false"}
            ref={setTriggerRef}
            onClick={toggleOptions}
          >
            <span class={styles.label}>Opciones</span>
            <span class={styles.dots}>...</span>
            <span class={styles.shortcut}>{modKey()} O</span>
          </button>
        </div>
      </Show>

      <Show when={hasOptions() && isOptionsOpen()}>
        <Portal>
          <div
            class={styles.optionsMenu}
            role="menu"
            ref={(el) => {
              setMenuRef(el);
              updateMenuPosition();
            }}
            style={{
              left: `${menuPosition().left}px`,
              top: `${menuPosition().top}px`,
            }}
          >
            <For each={props.options}>
              {(option) => (
                <button
                  type="button"
                  class={[
                    styles.optionsMenuItem,
                    option.danger && styles.optionsMenuItemDanger,
                  ]}
                  disabled={option.disabled}
                  onClick={() => {
                    if (option.disabled) {
                      return;
                    }
                    option.onSelect();
                    closeOptions();
                  }}
                >
                  <span class={styles.optionsMenuIcon}>
                    <option.icon size={14} />
                  </span>
                  <span>{option.label}</span>
                </button>
              )}
            </For>
          </div>
        </Portal>
      </Show>

      <button
        type="button"
        class={styles.primaryButton}
        disabled={props.primary.disabled}
        onClick={runPrimary}
      >
        <Show when={props.primary.icon}>
          <span class={styles.icon}>{props.primary.icon}</span>
        </Show>
        <span class={styles.label}>{props.primary.label}</span>
        <Show when={props.primary.shortcut}>
          {(shortcut) => (
            <span class={styles.shortcut}>
              {modKey()} {shortcut()}
            </span>
          )}
        </Show>
      </button>
    </footer>
  );
}
