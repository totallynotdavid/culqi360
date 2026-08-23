import { useParams, type RouteSectionProps } from "@solidjs/router";
import { Loading } from "solid-js";

import { PageCardLayout } from "~/components/ui/layout/page-card/page-card-layout";
import { RecordShowHeader } from "~/features/record-show/header/record-show-header";
import { RecordShowHeaderActions } from "~/features/record-show/header/record-show-header-actions";

import { RecordShowShellSkeleton } from "./skeletons/record-show-shell-skeleton";

export function RecordShowShell(props: RouteSectionProps) {
  const params = useParams<{ recordId: string }>();

  return (
    <PageCardLayout
      header={
        <RecordShowHeader leadId={params.recordId}>
          <RecordShowHeaderActions leadId={params.recordId} />
        </RecordShowHeader>
      }
    >
      <Loading fallback={<RecordShowShellSkeleton />}>{props.children}</Loading>
    </PageCardLayout>
  );
}
