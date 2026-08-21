import { Show, createSignal, onSettled } from "solid-js";

import { scheduleVisualMount } from "~/browser/visual/runtime/visual-mount-scheduler";
import { useIsMobile } from "~/components/ui/layout/responsive/use-is-mobile";
import { preloadSidePanelEntryPages } from "~/features/side-panel/registry/lazy-pages";

import { Router } from "../router/router";
import { DesktopSidePanelContent } from "./desktop-content";
import { DesktopSidePanelFrame } from "./desktop-frame";
import { MobileShell } from "./mobile-shell";

export function SidePanelHost() {
  const [isHydrated, setIsHydrated] = createSignal(false);
  const isMobile = useIsMobile();

  // Desktop is rendered on the server; mobile waits for hydration because it portals.
  const isDesktopInteractive = () => isHydrated() && !isMobile();

  onSettled(() => {
    setIsHydrated(true);

    // Preload the cold entry pages before the first panel open.
    const cancelPreload = scheduleVisualMount(preloadSidePanelEntryPages, {
      priority: "priority",
    });

    return cancelPreload;
  });

  return (
    <>
      <DesktopSidePanelFrame
        isInteractive={isDesktopInteractive()}
        renderContent={() =>
          isDesktopInteractive() ? <DesktopSidePanelContent /> : <></>
        }
        shouldRenderChildren={isDesktopInteractive()}
      />

      <Show when={isHydrated() && isMobile()}>
        <MobileShell targetVariant="fullScreen">
          <Router isMobile />
        </MobileShell>
      </Show>
    </>
  );
}
