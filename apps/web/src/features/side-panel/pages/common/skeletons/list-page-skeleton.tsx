import { For } from "solid-js";

import { Skeleton } from "~/components/ui/feedback/skeleton";

import styles from "./list-page-skeleton.module.css";

const GROUP_ITEM_COUNTS = [4, 3];

export function ListPageSkeleton() {
  return (
    <div class={styles.root}>
      <For keyed={false} each={GROUP_ITEM_COUNTS}>
        {(itemCount) => (
          <div class={styles.group}>
            <Skeleton width={80} height={11} />
            <For keyed={false} each={Array.from({ length: itemCount() })}>
              {() => (
                <div class={styles.item}>
                  <Skeleton width={16} height={16} radius={4} />
                  <Skeleton width="60%" height={13} />
                </div>
              )}
            </For>
          </div>
        )}
      </For>
    </div>
  );
}
