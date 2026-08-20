import { Show } from "solid-js";

import ChevronRight from "~/components/icons/chevron-right";

import styles from "./navigation-drawer-section.module.css";

interface Props {
  label: string;
  onClick?: () => void;
  isOpen?: boolean;
}

export function NavigationDrawerSectionTitle(props: Props) {
  return (
    <Show
      when={props.onClick}
      fallback={
        <div class={styles.sectionTitle}>
          <SectionTitleContent label={props.label} isOpen={props.isOpen} />
        </div>
      }
    >
      {(onClick) => (
        <button
          type="button"
          class={styles.sectionTitle}
          onClick={onClick()}
          aria-expanded={props.isOpen ? "true" : "false"}
        >
          <SectionTitleContent label={props.label} isOpen={props.isOpen} />
        </button>
      )}
    </Show>
  );
}

function SectionTitleContent(props: { label: string; isOpen?: boolean }) {
  return (
    <span class={styles.sectionTitleLabelContainer}>
      <span class={styles.sectionTitleLabel}>{props.label}</span>
      <Show when={props.isOpen !== undefined}>
        <span class={styles.sectionTitleChevron}>
          <ChevronRight
            size={12}
            style={{
              transform: props.isOpen ? "rotate(90deg)" : "rotate(0deg)",
            }}
          />
        </span>
      </Show>
    </span>
  );
}
