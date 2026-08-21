import type { ParentProps } from "solid-js";

import { RealtimeStatusBanner } from "~/browser/realtime/realtime-status-banner";
import { ImpersonationBanner } from "~/features/impersonation/impersonation-banner";
import { MobileNavigationBar } from "~/features/navigation-drawer/mobile/mobile-navigation-bar";
import { NavigationDrawerHost } from "~/features/navigation-drawer/shell/navigation-drawer-host";

import { MainAppLayoutWithSidePanel } from "./main-app-layout-with-side-panel";

import shellStyles from "../shell.module.css";

export function AppShellFrame(props: ParentProps) {
  return (
    <div class={shellStyles.layoutRoot}>
      <ImpersonationBanner />
      <RealtimeStatusBanner />
      <div class={shellStyles.root}>
        <NavigationDrawerHost />
        <div class={shellStyles.main}>
          <MainAppLayoutWithSidePanel>
            {props.children}
          </MainAppLayoutWithSidePanel>
        </div>
      </div>
      <MobileNavigationBar />
    </div>
  );
}
