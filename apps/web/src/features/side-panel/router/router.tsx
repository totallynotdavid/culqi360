import { Motion } from "@crm/solid-motion";
import { Errored, Show, Loading } from "solid-js";

import { HotkeyBoundary } from "../core/hotkeys/hotkey-boundary";
import { SIDE_PANEL_PAGES_CONFIG } from "../registry/page-registry";
import { useSidePanel } from "../state/use-side-panel";
import { TopBar } from "../top-bar/top-bar";
import { Container } from "./container";
import { PageInstanceProvider } from "./page-instance-context";

import styles from "./router.module.css";

export function Router(props: { isMobile: boolean }) {
  const { currentEntry } = useSidePanel();

  return (
    <Container isMobile={props.isMobile}>
      <div class={styles.router}>
        <Motion.div
          class={styles.topBar}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.075, delay: 0.1 }}
        >
          <TopBar isMobile={props.isMobile} />
        </Motion.div>

        <div class={styles.pageBody}>
          <Show when={currentEntry()} keyed>
            {(entry) => {
              const pageConfig = SIDE_PANEL_PAGES_CONFIG[entry.page];
              const PageComponent = pageConfig.component;
              const PageSkeleton = pageConfig.skeleton;

              return (
                <HotkeyBoundary class={styles.pageContent}>
                  <PageInstanceProvider pageId={entry.pageId}>
                    <Loading fallback={<PageSkeleton />}>
                      <Errored
                        fallback={
                          <div class={styles.pageState}>
                            No se pudo cargar el panel.
                          </div>
                        }
                      >
                        <PageComponent />
                      </Errored>
                    </Loading>
                  </PageInstanceProvider>
                </HotkeyBoundary>
              );
            }}
          </Show>
        </div>
      </div>
    </Container>
  );
}
