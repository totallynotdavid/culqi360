import { Show, createMemo } from "solid-js";

import { useEnrichmentWatch } from "~/features/record-show/use-enrichment-watch";
import { leadDetailQuery } from "~/rpc/workflow/lead-detail";

import { RecordLeftPanel } from "../panels/record-left-panel";
import { RecordRightPanel } from "../panels/record-right-panel";

import styles from "./record-show-page.module.css";

type RecordShowPageProps = {
  recordId: string;
};

export function RecordShowPage(props: RecordShowPageProps) {
  const data = createMemo(() => leadDetailQuery(props.recordId));

  useEnrichmentWatch(() => data()?.lead.ruc);

  return (
    <Show when={data()}>
      {(detail) => (
        <div class={styles.layout}>
          <RecordLeftPanel data={detail()} evaluatedAt={detail().evaluatedAt} />
          <RecordRightPanel data={detail()} />
        </div>
      )}
    </Show>
  );
}
