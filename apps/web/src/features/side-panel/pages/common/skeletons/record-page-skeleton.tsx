import { For } from "solid-js";

import { Skeleton } from "~/components/ui/feedback/skeleton";

import styles from "./record-page-skeleton.module.css";

const TABS = Array.from({ length: 3 }, (_unused, index) => index);

export function RecordPageSkeleton() {
  return (
    <div class={styles.root}>
      <div class={styles.tabStrip}>
        <For keyed={false} each={TABS}>
          {() => <Skeleton width={72} height={20} radius={6} />}
        </For>
      </div>
      <div class={styles.section}>
        <Skeleton width="50%" height={13} />
        <Skeleton height={60} radius={8} />
        <Skeleton height={60} radius={8} />
        <Skeleton height={60} radius={8} />
      </div>
    </div>
  );
}
