import { JOB_KINDS, type JobEvent } from "~/contracts/jobs/job-event";
import type { RecordImportDetail } from "~/contracts/records/imports";
import type { IntegrationJobRow } from "~/server/integrations/types";

/**
 * A record import's live state.
 *
 * The run is the subject here, unlike a GPV snapshot: an import is started from
 * a file picker and watched once, so there is no durable entity behind it to key
 * on.
 */
export function buildRecordImportJobEvent(
  job: Pick<
    IntegrationJobRow,
    | "id"
    | "type"
    | "queue_state"
    | "rows_applied"
    | "rows_failed"
    | "rows_total"
    | "error_message"
  >,
  stale?: readonly string[],
): JobEvent<RecordImportDetail> {
  return {
    kind: JOB_KINDS.recordImport,
    subjectId: job.id,
    state: job.queue_state,
    progress: {
      completed: job.rows_applied ?? 0,
      failed: job.rows_failed ?? 0,
      total: job.rows_total ?? 0,
    },
    errorMessage: job.error_message,
    detail: { importType: job.type },
    stale,
  };
}
