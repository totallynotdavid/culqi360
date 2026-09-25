import { Show, createMemo } from "solid-js";

import { createRecordPageController } from "~/features/record-show/record-page-controller";
import { leadDetailQuery } from "~/rpc/workflow/lead-detail";

import { RecordLeftPanel } from "../panels/record-left-panel";
import { RecordRightPanel } from "../panels/record-right-panel";

import styles from "./record-show-page.module.css";

type RecordShowPageProps = {
  recordId: string;
};

const POLL_INTERVAL_MS = 3_500;
const POLL_TIMEOUT_MS = 60_000;

export function RecordShowPage(props: RecordShowPageProps) {
  const data = createMemo(() => leadDetailQuery(props.recordId));

  createRecordPageController({
    leadId: () => props.recordId,
    detailData: data,
    pollIntervalMs: POLL_INTERVAL_MS,
    pollTimeoutMs: POLL_TIMEOUT_MS,
  });

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
