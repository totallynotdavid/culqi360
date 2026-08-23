import {
  type Accessor,
  type ParentProps,
  createContext,
  useContext,
} from "solid-js";

import { selectCurrentEntry, selectNavigationStack } from "../core/selectors";
import type {
  SidePanelNavigationEntry,
  SidePanelPageDefinition,
  SidePanelPageState,
} from "../types/side-panel-page";
import { readSidePanelWidthFromCookie } from "./side-panel-width";
import { createSidePanelStore } from "./store";

export type SidePanelContextValue = {
  isOpen: Accessor<boolean>;
  isClosing: Accessor<boolean>;
  currentEntry: Accessor<SidePanelNavigationEntry | null>;
  navigationStack: Accessor<SidePanelNavigationEntry[]>;
  searchText: Accessor<string>;
  panelWidth: Accessor<number>;
  getPageState: (pageId: string) => SidePanelPageState | undefined;
  updatePageState: (
    pageId: string,
    updater: (state: SidePanelPageState) => SidePanelPageState,
  ) => void;
  openPanel: (page: SidePanelPageDefinition) => void;
  closePanel: () => void;
  navigateTo: (
    page: SidePanelPageDefinition,
    opts?: { resetStack?: boolean },
  ) => void;
  goBack: () => void;
  navigateToStackIndex: (index: number) => void;
  onCloseAnimationComplete: () => void;
  setSearchText: (text: string) => void;
  setPanelWidth: (width: number) => void;
};

const SidePanelContext = createContext<SidePanelContextValue>();

export function SidePanelProvider(props: ParentProps) {
  const store = createSidePanelStore({
    initialWidth: readSidePanelWidthFromCookie(),
  });
  const { state } = store;
  const currentEntry: Accessor<SidePanelNavigationEntry | null> = () =>
    selectCurrentEntry(state);
  const navigationStack: Accessor<SidePanelNavigationEntry[]> = () =>
    selectNavigationStack(state);

  const value: SidePanelContextValue = {
    isOpen: () => state.isOpen,
    isClosing: () => state.isClosing,
    currentEntry,
    navigationStack,
    searchText: () => state.searchText,
    panelWidth: store.panelWidth,
    getPageState: (pageId) => state.pageStateById[pageId],
    updatePageState: store.updatePageState,
    openPanel: store.openPanel,
    closePanel: store.closePanel,
    navigateTo: store.navigateTo,
    goBack: store.goBack,
    navigateToStackIndex: store.navigateToStackIndex,
    onCloseAnimationComplete: store.onCloseAnimationComplete,
    setSearchText: store.setSearchText,
    setPanelWidth: store.setPanelWidth,
  };

  return <SidePanelContext value={value}>{props.children}</SidePanelContext>;
}

export function useSidePanel(): SidePanelContextValue {
  const ctx = useContext(SidePanelContext);
  if (ctx === undefined) {
    throw new Error("useSidePanel must be used within a SidePanelProvider");
  }
  return ctx;
}
