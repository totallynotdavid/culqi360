import { For } from "solid-js";

import { Skeleton } from "~/components/ui/feedback/skeleton";
import { WidgetSkeleton } from "~/features/widgets/widget-skeleton";

import styles from "./merchant-gpv-shell-skeleton.module.css";

const TABS = Array.from({ length: 4 }, (_unused, index) => index);
const WIDGETS = Array.from({ length: 4 }, (_unused, index) => index);

export function MerchantGpvShellSkeleton() {
  return (
    <div class={styles.root}>
      <div class={styles.tabStrip}>
        <For keyed={false} each={TABS}>
          {() => <Skeleton width={100} height={24} radius={6} />}
        </For>
      </div>

      <div class={styles.filterBar}>
        <Skeleton width={140} height={28} radius={6} />
        <Skeleton width={140} height={28} radius={6} />
      </div>

      <div class={styles.grid}>
        <For keyed={false} each={WIDGETS}>
          {() => <WidgetSkeleton />}
        </For>
      </div>
    </div>
  );
}
