import { createEffect, createMemo, type Accessor } from "solid-js";

import { createPollingController } from "~/features/side-panel/core/polling/create-polling-controller";
import {
  revalidateWorkflowLeadDetail,
  revalidateWorkflowLeadList,
} from "~/features/workflow/data/revalidate-workflow";

const POLLING_STATUSES = new Set(["queued", "running"]);

type RecordPageControllerInput = {
  leadId: Accessor<string>;
  detailData: Accessor<
    { sourceStatus: { sunat: { status: string } } } | undefined
  >;
  pollIntervalMs: number;
  pollTimeoutMs: number;
};

export function createRecordPageController(input: RecordPageControllerInput) {
  const sunatStatus = createMemo(
    () => input.detailData()?.sourceStatus.sunat.status,
  );

  const poller = createPollingController({
    intervalMs: input.pollIntervalMs,
    timeoutMs: input.pollTimeoutMs,
    shouldContinue: () => {
      const status = sunatStatus();
      return status !== undefined && POLLING_STATUSES.has(status);
    },
    runOnce: () => revalidateWorkflowLeadDetail(input.leadId()),
  });

  createEffect(sunatStatus, (status, previousStatus) => {
    if (!status) {
      poller.stop();
      return;
    }

    const wasPolling = previousStatus
      ? POLLING_STATUSES.has(previousStatus)
      : false;
    const isPolling = POLLING_STATUSES.has(status);

    // The list shows the resolved SUNAT status, so it only needs a refresh on
    // the polling-to-settled edge.
    if (wasPolling && !isPolling) {
      revalidateWorkflowLeadList();
    }

    if (isPolling) {
      poller.start();
    } else {
      poller.stop();
    }
  });

  return {
    pollingState: poller.state,
  };
}
