import { createEffect } from "solid-js";

import { useIsSettingsDrawer } from "../hooks/use-is-settings-drawer";
import { useIsSettingsPage } from "../hooks/use-is-settings-page";
import { SettingsNavigationDrawer } from "../settings/settings-navigation-drawer";
import { useNavigationDrawerState } from "../state/navigation-drawer-provider";
import { MainNavigationDrawer } from "./main-navigation-drawer";

export function AppNavigationDrawer() {
  const isSettingsDrawer = useIsSettingsDrawer();
  const isSettingsPage = useIsSettingsPage();
  const { isMobile, setCurrentMobileDrawer, expanded, setExpanded } =
    useNavigationDrawerState();

  createEffect(
    () => ({
      mobile: isMobile(),
      settings: isSettingsPage(),
      isExpanded: expanded(),
    }),
    ({ mobile, settings, isExpanded }) => {
      if (mobile) {
        if (settings) {
          setCurrentMobileDrawer("settings");
        }
        return;
      }

      if (settings && !isExpanded) {
        setExpanded(true);
      }
    },
  );

  return (
    <>
      {isSettingsDrawer() ? (
        <SettingsNavigationDrawer />
      ) : (
        <MainNavigationDrawer />
      )}
    </>
  );
}
