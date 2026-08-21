import { createContext, type ParentProps, useContext } from "solid-js";

import { navigationDrawerAdvancedModeCookie } from "./navigation-drawer-advanced-mode";
import { navigationDrawerExpandedCookie } from "./navigation-drawer-expanded";
import {
  createNavigationDrawerStore,
  type NavigationDrawerStateValue,
} from "./navigation-drawer-store";
import { readNavigationDrawerWidthFromCookie } from "./navigation-drawer-width";

const NavigationDrawerStateContext =
  createContext<NavigationDrawerStateValue>();

export function NavigationDrawerStateProvider(props: ParentProps) {
  const value = createNavigationDrawerStore({
    initialWidth: readNavigationDrawerWidthFromCookie(),
    initialExpanded: navigationDrawerExpandedCookie.read() ?? true,
    initialAdvancedModeEnabled:
      navigationDrawerAdvancedModeCookie.read() ?? false,
  });

  return (
    <NavigationDrawerStateContext value={value}>
      {props.children}
    </NavigationDrawerStateContext>
  );
}

export function useNavigationDrawerState() {
  const context = useContext(NavigationDrawerStateContext);

  if (!context) {
    throw new Error(
      "useNavigationDrawerState must be used within NavigationDrawerStateProvider",
    );
  }

  return context;
}
