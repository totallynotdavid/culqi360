import { clsx } from "clsx";
import { Show, createEffect } from "solid-js";

import X from "~/components/icons/x";

import { SIDE_PANEL_PAGES_CONFIG } from "../registry/page-registry";
import { useSidePanel } from "../state/use-side-panel";
import { BackButton } from "./back-button";
import { PageInfo } from "./page-info";
import { TopBarActions } from "./top-bar-actions";

import styles from "./top-bar.module.css";

export function TopBar(props: { isMobile: boolean }) {
  const {
    navigationStack,
    currentEntry,
    closePanel,
    goBack,
    searchText,
    setSearchText,
  } = useSidePanel();

  let inputRef: HTMLInputElement | undefined;

  const showBackButton = () => navigationStack().length > 1;
  const showCloseButton = () => !(props.isMobile && showBackButton());

  const showSearch = () => {
    const entry = currentEntry();

    if (!entry) {
      return false;
    }

    return SIDE_PANEL_PAGES_CONFIG[entry.page].showsSearch;
  };

  // Tracking pageId, not the entry object, is what re-focuses when the same
  // search page is opened again.
  createEffect(
    () => {
      const entry = currentEntry();

      return entry && SIDE_PANEL_PAGES_CONFIG[entry.page].showsSearch
        ? entry.pageId
        : null;
    },
    (searchPageId) => {
      if (searchPageId !== null) {
        inputRef?.focus();
      }
    },
  );

  function handleKeyDown(event: KeyboardEvent) {
    if (event.isComposing) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();

      if (searchText() !== "") {
        setSearchText("");
        return;
      }

      goBack();
      return;
    }

    if (event.key === "Backspace" && searchText() === "" && showBackButton()) {
      event.preventDefault();
      event.stopPropagation();
      goBack();
    }
  }

  return (
    <div class={clsx(styles.topBar, props.isMobile && styles.topBarMobile)}>
      <div class={styles.content}>
        <BackButton visible={showBackButton()} />

        <Show when={showSearch()} fallback={<PageInfo />}>
          <input
            ref={(element) => {
              inputRef = element;
            }}
            type="text"
            class={styles.searchInput}
            placeholder="Buscar o escribir un comando..."
            value={searchText()}
            onInput={(event) => setSearchText(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
          />
        </Show>
      </div>

      <div class={styles.rightControls}>
        <TopBarActions />

        <Show when={showCloseButton()}>
          <button
            type="button"
            class={styles.closeButton}
            onClick={closePanel}
            aria-label="Cerrar panel"
          >
            <X size={16} />
          </button>
        </Show>
      </div>
    </div>
  );
}
