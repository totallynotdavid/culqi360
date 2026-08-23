import { For, Show } from "solid-js";

import { Badge } from "~/components/ui/display/badge";
import { QUALITY_ISSUE_COPY } from "~/contracts/merchant-stats/quality-copy";
import type { QualitySummary } from "~/contracts/merchant-stats/views";
import { QUALITY_ISSUES } from "~/contracts/merchant-stats/vocabulary";

import { formatInteger } from "../format";

import styles from "./quality-panel.module.css";

export function QualityPanel(props: { summary: QualitySummary }) {
  return (
    <ul class={styles.list}>
      <For each={QUALITY_ISSUES}>
        {(issue) => (
          <li class={styles.row}>
            <a
              href={`/dashboards/merchant-gpv/quality/${issue}`}
              class={styles.link}
            >
              <span class={styles.label}>
                {QUALITY_ISSUE_COPY[issue].label}
              </span>
              <Show
                when={props.summary[issue] > 0}
                fallback={
                  <span class={styles.zero}>
                    {formatInteger(props.summary[issue])}
                  </span>
                }
              >
                <Badge variant="warning">
                  {formatInteger(props.summary[issue])}
                </Badge>
              </Show>
            </a>
          </li>
        )}
      </For>
    </ul>
  );
}
