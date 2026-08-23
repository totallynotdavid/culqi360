import { useAction, useLocation, useNavigate } from "@solidjs/router";
import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { Show, createSignal } from "solid-js";

import LayoutSidebarLeftCollapse from "~/components/icons/layout-sidebar-left-collapse";
import Search from "~/components/icons/search";
import X from "~/components/icons/x";
import { AccountMenu } from "~/components/layout/account-menu";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import { LightIconButton } from "~/components/ui/input/light-icon-button";
import { useResizablePanel } from "~/components/ui/layout/resizable-panel/use-resizable-panel";
import { shortName } from "~/domain/identity/display-name";
import { logoutMutation } from "~/features/auth/data/mutations";
import { useSidePanelMenu } from "~/features/side-panel/hooks/use-side-panel-menu";

import { NAVIGATION_DRAWER_CLICK_OUTSIDE_ID } from "../constants/navigation-drawer-click-outside-id";
import { useIsSettingsDrawer } from "../hooks/use-is-settings-drawer";
import { useNavigationDrawerState } from "../state/navigation-drawer-provider";
import {
  NAVIGATION_DRAWER_WIDTH_CONSTRAINTS,
  NAVIGATION_DRAWER_WIDTH_VAR,
} from "../state/navigation-drawer-width";
import { NavigationDrawerWidthEffect } from "./navigation-drawer-width-effect";

import styles from "./navigation-drawer-shell.module.css";

export function NavigationDrawer(props: {
  title: string;
  className?: string;
  children: JSX.Element;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuthenticatedSession();
  const {
    expanded,
    setExpanded,
    width,
    setWidth,
    isMobile,
    memorizedExpanded,
    memorizedPath,
    setHasMemorizedNavigation,
    memorizeNavigationState,
  } = useNavigationDrawerState();
  const isSettingsDrawer = useIsSettingsDrawer();
  const { openSearchRecordsPage } = useSidePanelMenu();
  const logout = useAction(logoutMutation);
  const [isResizing, setIsResizing] = createSignal(false);

  const onPointerDown = useResizablePanel({
    side: "right",
    constraints: NAVIGATION_DRAWER_WIDTH_CONSTRAINTS,
    getCurrentWidth: width,
    onWidthChange: setWidth,
    onCollapse: () => setExpanded(false),
    onResizeStart: () => setIsResizing(true),
    onResizeEnd: () => setIsResizing(false),
    cssVariableName: NAVIGATION_DRAWER_WIDTH_VAR,
    dragThresholdPx: 4,
  });

  function memorizeNavigation() {
    memorizeNavigationState(location.pathname + location.search, expanded());
  }

  function closeSettings() {
    navigate(memorizedPath(), { replace: true });
    setExpanded(memorizedExpanded());
    setHasMemorizedNavigation(false);
  }

  return (
    <aside
      class={styles.drawerHost}
      data-click-outside-id={NAVIGATION_DRAWER_CLICK_OUTSIDE_ID}
    >
      <NavigationDrawerWidthEffect />

      <div
        class={clsx(
          styles.drawer,
          isResizing() && styles.drawerResizing,
          props.className,
          expanded() && !isMobile() && styles.drawerExpandedDesktop,
          !expanded() && !isMobile() && styles.drawerCollapsedDesktop,
          isMobile() && expanded() && styles.drawerOpenMobile,
        )}
      >
        <div class={styles.drawerInner}>
          <Show
            when={!isMobile() && isSettingsDrawer()}
            fallback={
              <header
                class={clsx(
                  styles.header,
                  !expanded() && styles.headerCollapsed,
                )}
              >
                <AccountMenu
                  label={shortName(currentUser())}
                  avatarUrl={currentUser().avatarUrl}
                  collapsed={!expanded() && !isMobile()}
                  onOpenSettings={memorizeNavigation}
                  onLogout={logout}
                />

                <div class={styles.headerActions}>
                  <Show when={!isMobile()}>
                    <LightIconButton
                      Icon={Search}
                      accent="secondary"
                      onClick={openSearchRecordsPage}
                      aria-label="Buscar"
                    />
                  </Show>

                  <Show when={expanded()}>
                    <div class={styles.collapseButtonContainer}>
                      <LightIconButton
                        Icon={LayoutSidebarLeftCollapse}
                        accent="secondary"
                        onClick={() => setExpanded(false)}
                        aria-label="Contraer barra lateral"
                      />
                    </div>
                  </Show>
                </div>
              </header>
            }
          >
            <header class={styles.settingsBackHeader}>
              <button
                type="button"
                class={styles.settingsBackButton}
                onClick={closeSettings}
              >
                <X size={16} color="var(--foreground-secondary)" />
                <span>{props.title}</span>
              </button>
            </header>
          </Show>

          {props.children}

          <Show when={!isMobile() && !isSettingsDrawer() && expanded()}>
            <button
              type="button"
              class={clsx(styles.resizeHandle, isResizing() && styles.resizing)}
              onPointerDown={onPointerDown}
              aria-label="Redimensionar barra lateral"
            />
          </Show>
        </div>
      </div>
    </aside>
  );
}
