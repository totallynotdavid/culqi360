import { createEffect, onSettled } from "solid-js";

import { useIsMobile } from "~/components/ui/layout/responsive/use-is-mobile";

import { navigationDrawerExpandedCookie } from "../state/navigation-drawer-expanded";
import { useNavigationDrawerState } from "../state/navigation-drawer-provider";

export function NavigationDrawerBrowserEffects() {
  const { setIsMobile, setExpanded } = useNavigationDrawerState();
  const isMobile = useIsMobile();

  onSettled(() => {
    const hasExpandedPreference =
      navigationDrawerExpandedCookie.read() !== null;

    if (!hasExpandedPreference && isMobile()) {
      setExpanded(false);
    }
  });

  createEffect(isMobile, (mobile) => {
    setIsMobile(mobile);
  });

  return null;
}
