import { type JSX } from "@solidjs/web";
import { Show, children, type ParentProps } from "solid-js";

import { OverflowingText } from "~/components/ui/overflow-tooltip/overflow-tooltip";

import styles from "./settings-section.module.css";

interface SettingsSectionProps extends ParentProps {
  title: string;
  description?: string;
  actions?: JSX.Element;
}

export function SettingsSection(props: SettingsSectionProps) {
  const actions = children(() => props.actions);

  return (
    <section class={styles.block}>
      <div class={styles.sectionHeader}>
        <div class={styles.titleRow}>
          <h2 class={styles.title}>{props.title}</h2>
          <div
            class={styles.sectionActions}
            data-empty={actions() ? undefined : "true"}
          >
            {actions()}
          </div>
        </div>
        <Show when={props.description}>
          {(description) => (
            <h3 class={styles.sectionDescription}>
              <OverflowingText text={description()} maxRows={5} />
            </h3>
          )}
        </Show>
      </div>
      <div class={styles.sectionContent}>{props.children}</div>
    </section>
  );
}
