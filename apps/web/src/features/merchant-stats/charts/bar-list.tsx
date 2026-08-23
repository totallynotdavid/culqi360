import { For, Show } from "solid-js";

import { Present } from "~/components/ui/control-flow/present";

import { formatRatio, formatSoles } from "../format";

import styles from "./bar-list.module.css";

export interface BarRow {
  key: string;
  label: string;
  sublabel?: string;
  value: number;
  target?: number | null;
  href?: string;
}

interface BarListProps {
  rows: BarRow[];
}

export function BarList(props: BarListProps) {
  const max = () =>
    Math.max(
      1,
      ...props.rows.map((row) => Math.max(row.value, row.target ?? 0)),
    );

  return (
    <div class={styles.list}>
      <For each={props.rows}>
        {(row) => {
          const width = () => `${(row.value / max()) * 100}%`;
          const targetLeft = () =>
            row.target != null ? `${(row.target / max()) * 100}%` : null;
          const hitsTarget = () =>
            row.target != null && row.value >= row.target;
          return (
            <div class={styles.row}>
              <div class={styles.head}>
                <Show
                  when={row.href}
                  fallback={
                    <span class={styles.label} title={row.label}>
                      {row.label}
                    </span>
                  }
                >
                  {(href) => (
                    <a class={styles.labelLink} href={href()} title={row.label}>
                      {row.label}
                    </a>
                  )}
                </Show>
                <span class={styles.value}>{formatSoles(row.value)}</span>
                <Present when={row.target}>
                  {(target) => (
                    <span class={styles.ratio}>
                      {formatRatio(row.value, target())}
                    </span>
                  )}
                </Present>
              </div>
              <div class={styles.track}>
                <div
                  class={[styles.fill, hitsTarget() && styles.fillHit]}
                  style={{ width: width() }}
                />
                <Show when={targetLeft()}>
                  {(left) => (
                    <div
                      class={styles.target}
                      style={{ left: left() }}
                      title={`Objetivo ${formatSoles(row.target ?? 0)}`}
                    />
                  )}
                </Show>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
