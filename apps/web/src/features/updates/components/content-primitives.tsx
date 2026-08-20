import type { JSX } from "@solidjs/web";
import { createUniqueId } from "solid-js";

import ChevronRight from "~/components/icons/chevron-right";

import styles from "./styles/content-primitives.module.css";

type CollapsibleProps = {
  title: string;
  children: JSX.Element;
  defaultOpen?: boolean;
};

export function Collapsible(props: CollapsibleProps) {
  const contentId = createUniqueId();
  return (
    <details class={styles.collapsible} open={props.defaultOpen}>
      <summary class={styles.trigger} aria-controls={contentId}>
        <span class={styles.chevron} aria-hidden="true">
          <ChevronRight size={16} />
        </span>
        <span class={styles.title}>{props.title}</span>
      </summary>
      <div class={styles.content} id={contentId}>
        {props.children}
      </div>
    </details>
  );
}

type UpdateLabelProps = {
  color?: string;
  children: JSX.Element;
};

export function UpdateLabel(props: UpdateLabelProps) {
  return (
    <span
      class={styles.label}
      style={props.color ? { "--update-label-color": props.color } : undefined}
    >
      {props.children}
    </span>
  );
}
