import { createSignal } from "solid-js";
import { createStore } from "solid-js";

import { reduceSidePanelPatch } from "../core/reducer";
import type {
  SidePanelPageDefinition,
  SidePanelPageState,
} from "../types/side-panel-page";
import type { SidePanelState } from "../types/side-panel-state";
import {
  clampSidePanelWidth,
  SIDE_PANEL_WIDTH_CONSTRAINTS,
  persistSidePanelWidthToCookie,
} from "./side-panel-width";

type SidePanelStoreOptions = {
  initialWidth?: number;
};

export function createSidePanelStore(options?: SidePanelStoreOptions) {
  const [panelWidth, setPanelWidthSignal] = createSignal(
    options?.initialWidth ?? SIDE_PANEL_WIDTH_CONSTRAINTS.default,
  );

  const [state, setState] = createStore<SidePanelState>({
    isOpen: false,
    isClosing: false,
    stack: [],
    pageStateById: {},
    searchText: "",
  });

  function applyAction(action: Parameters<typeof reduceSidePanelPatch>[1]) {
    setState((draft) => {
      const patch = reduceSidePanelPatch(draft, action);

      if (patch) {
        Object.assign(draft, patch);
      }
    });
  }

  const openPanel = (page: SidePanelPageDefinition) => {
    applyAction({ type: "open-panel", page });
  };

  const closePanel = () => {
    applyAction({ type: "close-panel" });
  };

  const onCloseAnimationComplete = () => {
    applyAction({ type: "close-animation-complete" });
  };

  const navigateTo = (
    page: SidePanelPageDefinition,
    opts?: { resetStack?: boolean },
  ) => {
    applyAction({
      type: "navigate-to",
      page,
      resetStack: opts?.resetStack,
    });
  };

  const goBack = () => {
    applyAction({ type: "go-back" });
  };

  const navigateToStackIndex = (index: number) => {
    applyAction({ type: "navigate-to-stack-index", index });
  };

  const setSearchText = (text: string) => {
    applyAction({ type: "set-search-text", text });
  };

  const updatePageState = (
    pageId: string,
    updater: (state: SidePanelPageState) => SidePanelPageState,
  ) => {
    // The updater must read through the draft. Outside the setter the store
    // returns committed values only, so while an earlier write is held back
    // (an async lookup in flight) a patch built from `state` drops it.
    setState((draft) => {
      const current = draft.pageStateById[pageId];

      if (!current) {
        return;
      }

      draft.pageStateById[pageId] = updater(current);
    });
  };

  const setPanelWidth = (width: number) => {
    const nextWidth = clampSidePanelWidth(width);
    setPanelWidthSignal(nextWidth);
    persistSidePanelWidthToCookie(nextWidth);
  };

  return {
    state,
    panelWidth,
    openPanel,
    closePanel,
    navigateTo,
    goBack,
    navigateToStackIndex,
    onCloseAnimationComplete,
    setSearchText,
    setPanelWidth,
    updatePageState,
  };
}
