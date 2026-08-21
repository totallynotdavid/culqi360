import { For } from "solid-js";

import { docs } from "~/features/docs/registry";

import styles from "./docs.module.css";

export default function DocsPage() {
  return (
    <div class={styles.page}>
      <div class={styles.pageTitle}>
        <span class={styles.titleMuted}>Centro de</span>
        <span class={styles.titleBold}>ayuda</span>
      </div>
      <div class={styles.docList}>
        <For each={docs}>
          {(doc) => (
            <a href={`/docs/${doc.slug}`} class={styles.docCard}>
              <div class={styles.docCardTitle}>{doc.title}</div>
              <div class={styles.docCardDesc}>{doc.description}</div>
            </a>
          )}
        </For>
      </div>
    </div>
  );
}
