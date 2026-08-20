import type { RouteSectionProps } from "@solidjs/router";
import { Loading } from "solid-js";

import { AppHeader } from "~/components/layout/app-header/app-header";
import { PageCardLayout } from "~/components/ui/layout/page-card/page-card-layout";

import { StandardShellSkeleton } from "./skeletons/standard-shell-skeleton";

export function StandardAppShell(props: RouteSectionProps) {
  return (
    <PageCardLayout header={<AppHeader />}>
      <Loading fallback={<StandardShellSkeleton />}>{props.children}</Loading>
    </PageCardLayout>
  );
}
