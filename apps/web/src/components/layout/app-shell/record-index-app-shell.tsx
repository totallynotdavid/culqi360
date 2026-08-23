import type { RouteSectionProps } from "@solidjs/router";
import { Loading } from "solid-js";

import { PageCardLayout } from "~/components/ui/layout/page-card/page-card-layout";

import { RecordIndexShellSkeleton } from "./skeletons/record-index-shell-skeleton";

export function RecordIndexAppShell(props: RouteSectionProps) {
  return (
    <PageCardLayout>
      <Loading fallback={<RecordIndexShellSkeleton />}>
        {props.children}
      </Loading>
    </PageCardLayout>
  );
}
