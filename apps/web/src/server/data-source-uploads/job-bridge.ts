import type {
  IngestJob,
  IngestJobDetail,
} from "~/contracts/data-sources/ingest";
import { JOB_KINDS, type JobEvent } from "~/contracts/jobs/job-event";
import type { DomainError } from "~/domain/errors";
import type { QueueState } from "~/domain/jobs/queue-state";
import { publishJobEvent } from "~/server/jobs/publish";
import type { DatabaseExecutor } from "~/server/platform/database/executor";
import { createLogger } from "~/shared/observability/runtime-logger";
import { isErr, type Result } from "~/shared/result";

const POLL_INTERVAL_MS = 2_000;

// A run that has not settled by here is stuck; the loop stops rather than
// polling the engine for the life of the process.
const MAX_TRACKING_MS = 30 * 60_000;

const logger = createLogger("ingest-bridge");

function queueStateOf(job: IngestJob): QueueState {
  if (job.outcome === "succeeded") {
    return "done";
  }

  if (job.outcome === "failed") {
    return "failed";
  }

  return job.step === "queued" ? "pending" : "processing";
}

export function buildIngestJobEvent(job: IngestJob): JobEvent<IngestJobDetail> {
  return {
    kind: JOB_KINDS.dataSourceIngest,
    subjectId: job.job_id,
    state: queueStateOf(job),
    progress: {
      completed: job.accepted_rows ?? 0,
      failed: job.invalid_doc_rows ?? 0,
      total: job.total_rows ?? 0,
    },
    errorMessage: job.error,
    detail: {
      step: job.step,
      sourceKey: job.source_key,
      gate: job.gate,
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Republishes engine ingest jobs onto the job channel.
 *
 * The engine keeps these jobs in its own SQLite and exposes them over HTTP only,
 * so it cannot notify anyone and something has to ask. This is that something:
 * one loop per running job on the instance that started it, rather than one loop
 * per open browser tab with no owner and nothing to cancel it. Every instance's
 * hub picks the result up through pg NOTIFY, so subscribers do not have to be on
 * the instance that polls.
 */
export function createIngestJobBridge(deps: {
  db: DatabaseExecutor;
  getJob: (jobId: string) => Promise<Result<IngestJob, DomainError>>;
}) {
  const tracked = new Set<string>();
  let draining = false;

  async function pump(jobId: string): Promise<void> {
    const startedAt = performance.now();

    for (;;) {
      if (draining || performance.now() - startedAt >= MAX_TRACKING_MS) {
        return;
      }

      // Sequential by nature: each read reports the state the next one advances
      // from, and running them together would just hammer the engine.
      // eslint-disable-next-line no-await-in-loop
      const result = await deps.getJob(jobId);

      if (isErr(result)) {
        logger.warn("ingest_job_read_failed", { jobId, error: result.error });
        return;
      }

      // eslint-disable-next-line no-await-in-loop
      await publishJobEvent(deps.db, buildIngestJobEvent(result.value));

      if (result.value.outcome !== "running") {
        return;
      }

      // eslint-disable-next-line no-await-in-loop
      await sleep(POLL_INTERVAL_MS);
    }
  }

  return {
    /** Idempotent: a job already being followed is not followed twice. */
    track(jobId: string): void {
      if (draining || tracked.has(jobId)) {
        return;
      }

      tracked.add(jobId);

      void pump(jobId)
        .catch((error: unknown) => {
          logger.error("ingest_job_tracking_failed", { jobId, error });
        })
        .finally(() => tracked.delete(jobId));
    },

    /**
     * Stops accepting work and lets the running loops fall out at their next
     * check. They hold no locks, so shutdown does not wait on them.
     */
    stop(): void {
      draining = true;
    },
  };
}
