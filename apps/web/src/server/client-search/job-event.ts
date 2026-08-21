import type { EnrichmentJobDetail } from "~/contracts/client-search/enrichment";
import { JOB_KINDS, type JobEvent } from "~/contracts/jobs/job-event";
import type { QueueState } from "~/domain/jobs/queue-state";

import type { EnrichmentStatus } from "./model";

function queueStateOf(lifecycle: EnrichmentStatus["lifecycle"]): QueueState {
  if (lifecycle === "succeeded") {
    return "done";
  }

  if (lifecycle === "failed") {
    return "failed";
  }

  return lifecycle === "running" ? "processing" : "pending";
}

/**
 * A document's enrichment as a job.
 *
 * Subscriptions are keyed by document value rather than by lead: several leads
 * can share a RUC, and the scrape happens once for all of them.
 *
 * Enrichment has no row count to report, so progress is the flat indeterminate
 * shape every consumer already handles for a job that has not counted its input.
 */
export function buildEnrichmentJobEvent(
  status: EnrichmentStatus,
  stale?: readonly string[],
): JobEvent<EnrichmentJobDetail> {
  return {
    kind: JOB_KINDS.clientEnrichment,
    subjectId: status.documentValue,
    state: queueStateOf(status.lifecycle),
    progress: { completed: 0, failed: 0, total: 0 },
    errorMessage: status.lastError,
    detail: { lifecycle: status.lifecycle },
    stale,
  };
}
