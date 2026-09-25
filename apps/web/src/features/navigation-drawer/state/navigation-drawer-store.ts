import { createSignal } from "solid-js";

import { useIsMobile } from "~/components/ui/layout/responsive/use-is-mobile";
import { isSettingsRoutePath } from "~/domain/navigation/route-classification";

import { navigationDrawerAdvancedModeCookie } from "./navigation-drawer-advanced-mode";
import { navigationDrawerExpandedCookie } from "./navigation-drawer-expanded";
import {
  clampNavigationDrawerWidth,
  NAVIGATION_DRAWER_WIDTH_CONSTRAINTS,
  persistNavigationDrawerWidthToCookie,
} from "./navigation-drawer-width";

type MobileDrawerType = "main" | "settings";

type NavigationDrawerStoreOptions = {
  initialWidth?: number;
  initialExpanded?: boolean;
  initialAdvancedModeEnabled?: boolean;
};

export interface NavigationDrawerStateValue {
  expanded: () => boolean;
  setExpanded: (value: boolean | ((current: boolean) => boolean)) => void;
  width: () => number;
  setWidth: (value: number) => void;
  isMobile: () => boolean;
  currentMobileDrawer: () => MobileDrawerType;
  setCurrentMobileDrawer: (
    value: MobileDrawerType | ((current: MobileDrawerType) => MobileDrawerType),
  ) => void;
  advancedModeEnabled: () => boolean;
  setAdvancedModeEnabled: (
    value: boolean | ((current: boolean) => boolean),
  ) => void;
  memorizedExpanded: () => boolean;
  setMemorizedExpanded: (
    value: boolean | ((current: boolean) => boolean),
  ) => void;
  memorizedPath: () => string;
  setMemorizedPath: (value: string | ((current: string) => string)) => void;
  hasMemorizedNavigation: () => boolean;
  setHasMemorizedNavigation: (
    value: boolean | ((current: boolean) => boolean),
  ) => void;
  memorizeNavigationState: (path: string, drawerExpanded: boolean) => void;
  isSectionOpen: (id: string) => boolean;
  setSectionOpen: (id: string, open: boolean) => void;
  toggleSectionOpen: (id: string) => void;
  isFolderOpen: (id: string) => boolean;
  toggleFolderOpen: (id: string) => void;
}

function isSettingsLikePath(path: string) {
  return isSettingsRoutePath(path);
}

export function createNavigationDrawerStore(
  options?: NavigationDrawerStoreOptions,
): NavigationDrawerStateValue {
  const [expanded, setExpandedSignal] = createSignal(
    options?.initialExpanded ?? true,
  );
  const [width, setWidthSignal] = createSignal(
    options?.initialWidth ?? NAVIGATION_DRAWER_WIDTH_CONSTRAINTS.default,
  );
  // One media-query listener for every consumer of the drawer state: useIsMobile
  // allocates its own on each call, so the store is where it belongs.
  const isMobile = useIsMobile();
  const [currentMobileDrawer, setCurrentMobileDrawer] =
    createSignal<MobileDrawerType>("main");
  const [advancedModeEnabled, setAdvancedModeEnabledSignal] = createSignal(
    options?.initialAdvancedModeEnabled ?? false,
  );
  const [memorizedExpanded, setMemorizedExpanded] = createSignal(true);
  const [memorizedPath, setMemorizedPath] = createSignal("/");
  const [hasMemorizedNavigation, setHasMemorizedNavigation] =
    createSignal(false);
  const [openSections, setOpenSections] = createSignal<Record<string, boolean>>(
    {},
  );
  const [openFolders, setOpenFolders] = createSignal<Record<string, boolean>>(
    {},
  );

  const setExpanded: NavigationDrawerStateValue["setExpanded"] = (value) => {
    const previous = expanded();
    const next = typeof value === "function" ? value(previous) : value;

    setExpandedSignal(next);
    navigationDrawerExpandedCookie.write(next);
  };

  const setAdvancedModeEnabled: NavigationDrawerStateValue["setAdvancedModeEnabled"] =
    (value) => {
      const previous = advancedModeEnabled();
      const next = typeof value === "function" ? value(previous) : value;
      setAdvancedModeEnabledSignal(next);
      navigationDrawerAdvancedModeCookie.write(next);
    };

  const isSectionOpen = (id: string) => {
    const state = openSections();
    const value = state[id];
    return value ?? true;
  };

  const setSectionOpen = (id: string, open: boolean) => {
    setOpenSections((current) => ({ ...current, [id]: open }));
  };

  const toggleSectionOpen = (id: string) => {
    setOpenSections((current) => ({
      ...current,
      [id]: !(current[id] ?? true),
    }));
  };

  const isFolderOpen = (id: string) => {
    const state = openFolders();
    const value = state[id];
    return value ?? true;
  };

  const toggleFolderOpen = (id: string) => {
    setOpenFolders((current) => ({
      ...current,
      [id]: !(current[id] ?? true),
    }));
  };

  const memorizeNavigationState = (path: string, drawerExpanded: boolean) => {
    if (isSettingsLikePath(path)) {
      return;
    }

    setMemorizedExpanded(drawerExpanded);
    setMemorizedPath(path);
    setHasMemorizedNavigation(true);
  };

  return {
    expanded,
    setExpanded,
    width,
    setWidth: (next) => {
      const clampedWidth = clampNavigationDrawerWidth(Math.round(next));
      setWidthSignal(clampedWidth);
      persistNavigationDrawerWidthToCookie(clampedWidth);
    },
    isMobile,
    currentMobileDrawer,
    setCurrentMobileDrawer,
    advancedModeEnabled,
    setAdvancedModeEnabled,
    memorizedExpanded,
    setMemorizedExpanded,
    memorizedPath,
    setMemorizedPath,
    hasMemorizedNavigation,
    setHasMemorizedNavigation,
    memorizeNavigationState,
    isSectionOpen,
    setSectionOpen,
    toggleSectionOpen,
    isFolderOpen,
    toggleFolderOpen,
  };
}
