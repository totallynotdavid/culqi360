import { createResizeObserver } from "@solid-primitives/resize-observer";
import { type JSX } from "@solidjs/web";
import {
  For,
  Show,
  children,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onSettled,
} from "solid-js";
import { createStore } from "solid-js";

import ChevronDown from "~/components/icons/chevron-down";
import {
  TabButton,
  TabMeasure,
} from "~/features/side-panel/components/tab-button";
import type { TabIconComponent } from "~/features/side-panel/components/tab-strip/types";

import styles from "./styles.module.css";

export type { TabIconComponent } from "./types";

const TAB_GAP = 4;

export type TabItem<TId extends string = string> = {
  id: TId;
  label: string;
  icon?: TabIconComponent;
  pill?: string;
};

type TabStripProps<TId extends string> = {
  tabs: ReadonlyArray<TabItem<TId>>;
  activeTab: TId;
  onTabSelect: (id: TId) => void;
  rightComponent?: JSX.Element;
};

export function TabStrip<TId extends string>(props: TabStripProps<TId>) {
  const rightComponent = children(() => props.rightComponent);

  const [tabWidths, setTabWidths] = createStore<
    Record<string, number | undefined>
  >({});
  const [containerWidth, setContainerWidth] = createSignal(0);
  const [moreButtonWidth, setMoreButtonWidth] = createSignal(0);
  const [isOverflowOpen, setIsOverflowOpen] = createSignal(false);

  const [containerRef, setContainerRef] = createSignal<HTMLDivElement>();
  const [moreButtonMeasureRef, setMoreButtonMeasureRef] =
    createSignal<HTMLDivElement>();
  const [overflowWrapRef, setOverflowWrapRef] = createSignal<HTMLDivElement>();

  const visibleTabCount = createMemo(() => {
    const width = containerWidth();
    const moreWidth = moreButtonWidth();
    const tabs = props.tabs;

    if (width === 0) {
      return tabs.length;
    }

    let totalWidth = 0;

    for (let index = 0; index < tabs.length; index++) {
      const tab = tabs[index];
      const tabWidth = tabWidths[tab.id];

      if (tabWidth === undefined) {
        return tabs.length;
      }

      const gap = index > 0 ? TAB_GAP : 0;
      const moreButtonSpace = index < tabs.length - 1 ? moreWidth + TAB_GAP : 0;

      totalWidth += tabWidth + gap;

      if (totalWidth + moreButtonSpace > width) {
        return Math.max(1, index);
      }
    }

    return tabs.length;
  });

  const hiddenTabs = createMemo(() => props.tabs.slice(visibleTabCount()));
  const hasHiddenTabs = createMemo(() => hiddenTabs().length > 0);
  const hiddenTabCount = createMemo(() => hiddenTabs().length);
  const isActiveTabHidden = createMemo(() =>
    hiddenTabs().some((tab) => tab.id === props.activeTab),
  );

  createResizeObserver(containerRef, ({ width }) => {
    setContainerWidth(width);
  });

  createResizeObserver(moreButtonMeasureRef, ({ width }) => {
    setMoreButtonWidth(width);
  });

  createEffect(
    () => hasHiddenTabs(),
    (hasHidden) => {
      if (!hasHidden) {
        setIsOverflowOpen(false);
      }
    },
  );

  onSettled(() => {
    const handleDocumentPointerDown = (event: PointerEvent) => {
      if (!isOverflowOpen()) {
        return;
      }

      const wrap = overflowWrapRef();

      if (!(event.target instanceof Node) || !wrap) {
        return;
      }

      if (wrap.contains(event.target)) {
        return;
      }

      setIsOverflowOpen(false);
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  });

  return (
    <div class={styles.tabs} ref={setContainerRef}>
      <div class={styles.hiddenMeasure}>
        <For each={props.tabs}>
          {(tab) => {
            const [element, setElement] = createSignal<HTMLDivElement>();

            createResizeObserver(element, ({ width }) => {
              setTabWidths((widths) => {
                widths[tab.id] = width;
              });
            });

            onCleanup(() => {
              setTabWidths((widths) => {
                widths[tab.id] = undefined;
              });
            });

            return (
              <TabMeasure
                ref={setElement}
                icon={tab.icon}
                title={tab.label}
                pill={tab.pill}
              />
            );
          }}
        </For>

        <div ref={setMoreButtonMeasureRef} class={styles.moreTab}>
          <span class={styles.moreTabContent}>
            <span>+99 más</span>
            <ChevronDown size={16} />
          </span>
        </div>
      </div>

      <div class={styles.tabContainer}>
        <For each={props.tabs.slice(0, visibleTabCount())}>
          {(tab) => (
            <TabButton
              dataTestId={`tab-${tab.id}`}
              icon={tab.icon}
              title={tab.label}
              pill={tab.pill}
              active={props.activeTab === tab.id}
              onClick={() => props.onTabSelect(tab.id)}
            />
          )}
        </For>
      </div>

      <Show when={hasHiddenTabs()}>
        <div class={styles.moreTabWrap} ref={setOverflowWrapRef}>
          <button
            type="button"
            data-testid="tab-tab-more-button"
            class={[
              styles.moreTab,
              isActiveTabHidden() && styles.moreTabActive,
            ]}
            onClick={() => setIsOverflowOpen((open) => !open)}
          >
            <span class={styles.moreTabContent}>
              <span>+{hiddenTabCount()} más</span>
              <ChevronDown size={16} />
            </span>
          </button>

          <Show when={isOverflowOpen()}>
            <div class={styles.moreMenu}>
              <For each={hiddenTabs()}>
                {(tab) => (
                  <button
                    type="button"
                    class={[
                      styles.moreMenuItem,
                      tab.id === props.activeTab && styles.moreMenuItemActive,
                    ]}
                    onClick={() => {
                      props.onTabSelect(tab.id);
                      setIsOverflowOpen(false);
                    }}
                  >
                    {tab.label}
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={rightComponent()}>
        <div class={styles.rightSlot}>{rightComponent()}</div>
      </Show>
    </div>
  );
}
