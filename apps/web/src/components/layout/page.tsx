import type { JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { Show } from "solid-js";

import styles from "./page.module.css";

type PageWidth = "narrow" | "medium" | "wide";

const WIDTH_CLASS: Record<PageWidth, string> = {
  narrow: styles.pageNarrow,
  medium: styles.pageMedium,
  wide: styles.pageWide,
};

interface BaseProps {
  children: JSX.Element;
  class?: string;
}

interface PageProps extends BaseProps {
  width?: PageWidth;
}

interface SectionTitleProps {
  class?: string;
  title: string;
  description?: string;
  actions?: JSX.Element;
}

export function AppPage(props: PageProps) {
  return (
    <div
      class={clsx(
        styles.page,
        props.width ? WIDTH_CLASS[props.width] : undefined,
        props.class,
      )}
    >
      {props.children}
    </div>
  );
}

export function AppPageBody(props: BaseProps) {
  return <div class={clsx(styles.pageBody, props.class)}>{props.children}</div>;
}

export function AppPageSection(props: BaseProps) {
  return (
    <section class={clsx(styles.section, props.class)}>
      <div class={styles.sectionBody}>{props.children}</div>
    </section>
  );
}

export function AppPageSectionTitle(props: SectionTitleProps) {
  return (
    <div class={clsx(styles.sectionTitle, props.class)}>
      <div>
        <h2 class={styles.title}>{props.title}</h2>
        <Show when={props.description}>
          {(description) => <p class={styles.description}>{description()}</p>}
        </Show>
      </div>
      <Show when={props.actions}>{(actions) => <div>{actions()}</div>}</Show>
    </div>
  );
}
