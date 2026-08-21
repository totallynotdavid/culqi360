import { Dynamic } from "@solidjs/web";
import { Show, createEffect } from "solid-js";

import type { RecordContext } from "~/features/record-show/model/record-context";
import type { RecordTabId } from "~/features/record-show/model/record-tab-id";
import { recordTabsFor } from "~/features/record-show/tabs/record-tabs-registry";
import { TabStrip } from "~/features/side-panel/components/tab-strip";

import styles from "./record-tabs.module.css";

export function RecordTabs(props: {
  context: RecordContext;
  activeTab: RecordTabId;
  onTabSelect: (tabId: RecordTabId) => void;
}) {
  const tabs = () => recordTabsFor(props.context);
  const activeDefinition = () =>
    tabs().find((tab) => tab.id === props.activeTab) ?? tabs()[0];

  // Stage changes can hide the persisted tab. Persist the visible fallback.
  createEffect(
    () => activeDefinition()?.id,
    (resolvedId) => {
      if (resolvedId !== undefined && resolvedId !== props.activeTab) {
        props.onTabSelect(resolvedId);
      }
    },
  );

  return (
    <>
      <TabStrip
        tabs={tabs()}
        activeTab={activeDefinition()?.id ?? props.activeTab}
        onTabSelect={props.onTabSelect}
      />
      {/* Keyed content remounts so each tab owns its state and entry transition. */}
      <Show when={activeDefinition()} keyed>
        {(definition) => (
          <div class={styles.pane}>
            <Dynamic
              component={definition.component}
              context={props.context}
              onNavigate={props.onTabSelect}
            />
          </div>
        )}
      </Show>
    </>
  );
}
