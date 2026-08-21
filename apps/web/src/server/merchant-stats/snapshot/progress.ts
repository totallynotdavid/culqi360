import { JOB_KINDS, type JobEvent } from "~/contracts/jobs/job-event";
import type { GpvSnapshotDetail } from "~/contracts/merchant-stats/imports";
import type { GpvSnapshotState } from "~/domain/merchant-stats/snapshot";

import type { GpvSnapshotJobRow } from "./repo";

/**
 * A snapshot import's live state.
 *
 * Subscriptions are keyed by snapshot rather than by job: the snapshot is what a
 * user opens and what survives a re-import, so a screen can subscribe from a URL
 * without first discovering which attempt is running.
 *
 * The snapshot state is only known once the run settles, and passing it here is
 * what lets a watching card show the outcome without waiting for the read it
 * just invalidated to come back.
 */
export function buildGpvSnapshotJobEvent(
  job: Pick<
    GpvSnapshotJobRow,
    | "snapshot_id"
    | "queue_state"
    | "rows_applied"
    | "rows_failed"
    | "rows_total"
    | "error_message"
  >,
  settled?: {
    snapshotState: GpvSnapshotState;
    stale: readonly string[];
  },
): JobEvent<GpvSnapshotDetail> {
  return {
    kind: JOB_KINDS.gpvSnapshot,
    subjectId: job.snapshot_id,
    state: job.queue_state,
    progress: {
      completed: job.rows_applied ?? 0,
      failed: job.rows_failed ?? 0,
      total: job.rows_total ?? 0,
    },
    errorMessage: job.error_message,
    detail: { snapshotState: settled?.snapshotState ?? null },
    stale: settled?.stale,
  };
}
