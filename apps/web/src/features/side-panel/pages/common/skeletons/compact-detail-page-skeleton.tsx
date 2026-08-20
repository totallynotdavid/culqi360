import { For } from "solid-js";

import { Skeleton } from "~/components/ui/feedback/skeleton";

import styles from "./compact-detail-page-skeleton.module.css";

const SECTIONS = Array.from({ length: 2 }, (_unused, index) => index);

export function CompactDetailPageSkeleton() {
  return (
    <div class={styles.root}>
      <div class={styles.hero}>
        <Skeleton width={32} height={32} radius={16} />
        <div class={styles.heroText}>
          <Skeleton width="70%" height={14} />
          <Skeleton width="40%" height={12} />
        </div>
      </div>

      <For keyed={false} each={SECTIONS}>
        {() => (
          <div class={styles.section}>
            <Skeleton width={64} height={11} />
            <Skeleton width="90%" height={13} />
          </div>
        )}
      </For>
    </div>
  );
}
