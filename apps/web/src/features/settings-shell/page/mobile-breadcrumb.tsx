import { Match, Show, Switch, createMemo } from "solid-js";

import ChevronLeft from "~/components/icons/chevron-left";
import { useNavigationDrawerState } from "~/features/navigation-drawer/state/navigation-drawer-provider";

import type { MobileBackAction } from "./breadcrumb-model";

import styles from "./breadcrumb.module.css";

interface MobileBackControlProps {
  action: MobileBackAction;
  class?: string;
}

export function MobileBackControl(props: MobileBackControlProps) {
  const { setExpanded, setCurrentMobileDrawer } = useNavigationDrawerState();

  const openSettingsDrawer = () => {
    setExpanded(true);
    setCurrentMobileDrawer("settings");
  };

  const openSettingsAction = createMemo(() =>
    props.action.kind === "open-settings-drawer" ? props.action : null,
  );
  const linkAction = createMemo(() =>
    props.action.kind === "link" ? props.action : null,
  );

  return (
    <Show when={props.action.kind !== "none"}>
      <nav
        class={`${styles.root} ${props.class ?? ""}`}
        aria-label="Breadcrumb"
      >
        <ChevronLeft size={16} />
        <Switch>
          <Match when={openSettingsAction()} keyed>
            {(action) => (
              <button
                type="button"
                class={styles.mobileBack}
                onClick={openSettingsDrawer}
              >
                {action.label}
              </button>
            )}
          </Match>
          <Match when={linkAction()} keyed>
            {(action) => (
              <a class={styles.link} href={action.href} title={action.label}>
                {action.label}
              </a>
            )}
          </Match>
        </Switch>
      </nav>
    </Show>
  );
}
