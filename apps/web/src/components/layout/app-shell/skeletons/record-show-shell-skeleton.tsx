import { For } from "solid-js";

import { Skeleton } from "~/components/ui/feedback/skeleton";

import styles from "./record-show-shell-skeleton.module.css";

const RAIL_FIELDS = Array.from({ length: 6 }, (_unused, index) => index);
const TABS = Array.from({ length: 4 }, (_unused, index) => index);

export function RecordShowShellSkeleton() {
  return (
    <div class={styles.layout}>
      <div class={styles.rail}>
        <For keyed={false} each={RAIL_FIELDS}>
          {() => (
            <div class={styles.railField}>
              <Skeleton width={72} height={11} />
              <Skeleton width="80%" height={14} />
            </div>
          )}
        </For>
      </div>

      <div class={styles.content}>
        <div class={styles.tabStrip}>
          <For keyed={false} each={TABS}>
            {() => <Skeleton width={84} height={24} radius={6} />}
          </For>
        </div>
        <div class={styles.section}>
          <Skeleton height={80} radius={8} />
          <Skeleton height={80} radius={8} />
        </div>
      </div>
    </div>
  );
}
