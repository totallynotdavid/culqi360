import { For } from "solid-js";

import { Skeleton } from "~/components/ui/feedback/skeleton";
import { PageCardHeader } from "~/components/ui/layout/page-card/page-card-header";

import styles from "./record-index-shell-skeleton.module.css";

const BODY_ROWS = Array.from({ length: 8 }, (_unused, index) => index);
const COLUMN_WIDTHS = [220, 96, 96, 120, 72];

export function RecordIndexShellSkeleton() {
  return (
    <div class={styles.root}>
      <PageCardHeader
        icon={<Skeleton width={24} height={24} radius={6} />}
        title={<Skeleton width={120} height={16} />}
        actionButton={<Skeleton width={96} height={28} radius={6} />}
      />

      <div class={styles.viewBar}>
        <Skeleton width={160} height={20} radius={4} />
        <div class={styles.viewBarActions}>
          <Skeleton width={28} height={20} radius={4} />
          <Skeleton width={28} height={20} radius={4} />
          <Skeleton width={28} height={20} radius={4} />
        </div>
      </div>

      <div class={styles.table}>
        <div class={styles.row}>
          <For keyed={false} each={COLUMN_WIDTHS}>
            {(width) => <Skeleton width={width()} height={12} />}
          </For>
        </div>
        <For keyed={false} each={BODY_ROWS}>
          {() => (
            <div class={styles.row}>
              <For keyed={false} each={COLUMN_WIDTHS}>
                {(width) => <Skeleton width={width()} height={14} />}
              </For>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
