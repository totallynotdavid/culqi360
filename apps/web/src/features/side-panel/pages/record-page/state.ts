import { createMemo, createSignal } from "solid-js";

import type { RecordTabId } from "~/features/record-show/model/record-tab-id";
import { resolveActiveRecordTabId } from "~/features/record-show/tabs/record-tabs-registry";

import { usePageInstanceId } from "../../router/page-instance-context";
import { useSidePanelPageState } from "../../router/page-state";
import { useSidePanel } from "../../state/use-side-panel";

export function useLeadRecordPageState() {
  const pageId = usePageInstanceId();
  const { updatePageState } = useSidePanel();
  const pageState = useSidePanelPageState("view-record");
  // Writable memo: the page overwrites it with the RUC once the lead detail
  // lands, and reopening the panel on another record recomputes it. Read once
  // at creation, it kept the first record's subtitle forever.
  const [subtitle, setSubtitle] = createSignal(() => pageState().subtitle);

  function setActiveTab(activeTab: RecordTabId) {
    updatePageState(pageId(), (state) => {
      if (state.page !== "view-record") {
        return state;
      }

      return { ...state, activeTab };
    });
  }

  const leadId = createMemo(() => pageState().leadId);

  const activeTab = createMemo<RecordTabId>(() =>
    resolveActiveRecordTabId(pageState().activeTab, "lead"),
  );

  return {
    pageState,
    leadId,
    activeTab,
    label: subtitle,
    setActiveTab,
    setSubtitle,
  };
}
