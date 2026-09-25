import { For, Show, createMemo } from "solid-js";

import { EmptyState } from "~/components/feedback/empty-state/empty";
import {
  describeFulfillmentStep,
  describeProductKind,
} from "~/contracts/workflow/fulfillment-labels";
import type { FulfillmentQueueRowView } from "~/contracts/workflow/views";
import type { FulfillmentStep } from "~/contracts/workflow/vocabulary";
import { fulfillmentQueueQuery } from "~/rpc/workflow/fulfillment-queue";

import styles from "./fulfillment-queue.module.css";

const STALE_AFTER_MS = 48 * 3_600_000;

function waitingLabel(since: number, evaluatedAt: number): string {
  const hours = Math.floor((evaluatedAt - since) / 3_600_000);
  if (hours < 1) {
    return "Hace menos de 1h";
  }
  if (hours < 24) {
    return `Hace ${hours}h`;
  }
  return `Hace ${Math.floor(hours / 24)}d`;
}

type Group = { step: FulfillmentStep; rows: FulfillmentQueueRowView[] };

function groupByStep(rows: FulfillmentQueueRowView[]): Group[] {
  const byStep = new Map<FulfillmentStep, FulfillmentQueueRowView[]>();
  for (const row of rows) {
    const existing = byStep.get(row.currentStep);
    if (existing) {
      existing.push(row);
    } else {
      byStep.set(row.currentStep, [row]);
    }
  }
  return [...byStep.entries()]
    .map(([step, groupRows]) => ({ step, rows: groupRows }))
    .toSorted((a, b) => a.rows[0].waitingSince - b.rows[0].waitingSince);
}

export default function FulfillmentQueuePage() {
  const queue = createMemo(() => fulfillmentQueueQuery(), {
    loadingValue: { rows: [], evaluatedAt: 0 },
  });
  const groups = () => groupByStep(queue().rows);

  return (
    <div class={styles.page}>
      <Show
        when={queue().rows.length > 0}
        fallback={
          <div class={styles.empty}>
            <EmptyState title="No hay entregas pendientes" />
          </div>
        }
      >
        <div class={styles.groups}>
          <For each={groups()}>
            {(group) => (
              <section class={styles.group}>
                <header class={styles.groupHeader}>
                  <span class={styles.groupTitle}>
                    {describeFulfillmentStep(group.step)}
                  </span>
                  <span class={styles.count}>{group.rows.length}</span>
                </header>
                <ul class={styles.queue}>
                  <For each={group.rows}>
                    {(row) => (
                      <a
                        href={`/records/${row.leadId}`}
                        class={styles.row}
                        aria-label={`Abrir ${row.legalName ?? `RUC ${row.ruc}`}`}
                        data-state={
                          queue().evaluatedAt - row.waitingSince >
                          STALE_AFTER_MS
                            ? "stale"
                            : "fresh"
                        }
                      >
                        <div class={styles.main}>
                          <span class={styles.ruc}>{row.ruc}</span>
                          <span class={styles.name}>
                            {row.legalName ?? "Sin razón social"}
                          </span>
                        </div>
                        <div class={styles.meta}>
                          <Show when={row.productKind}>
                            {(kind) => (
                              <span class={styles.tag}>
                                {describeProductKind(kind())}
                              </span>
                            )}
                          </Show>
                          <span class={styles.executive}>
                            {row.executiveName}
                          </span>
                          <span class={styles.waiting}>
                            {waitingLabel(
                              row.waitingSince,
                              queue().evaluatedAt,
                            )}
                          </span>
                        </div>
                      </a>
                    )}
                  </For>
                </ul>
              </section>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
