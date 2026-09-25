import { onSettled } from "solid-js";

import { navigationDrawerExpandedCookie } from "../state/navigation-drawer-expanded";
import { useNavigationDrawerState } from "../state/navigation-drawer-provider";

export function NavigationDrawerBrowserEffects() {
  const { isMobile, setExpanded } = useNavigationDrawerState();

  onSettled(() => {
    const hasExpandedPreference =
      navigationDrawerExpandedCookie.read() !== null;

    if (!hasExpandedPreference && isMobile()) {
      setExpanded(false);
    }
  });

  return null;
}
