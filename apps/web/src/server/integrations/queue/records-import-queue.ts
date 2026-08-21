import { QUERY_KEYS } from "~/contracts/query-keys";
import { publishJobEvent } from "~/server/jobs/publish";
import { createJobQueue } from "~/server/platform/jobs/job-queue";
import type { JobContext } from "~/server/platform/operation/context";
import { buildRecordImportJobEvent } from "~/server/records/imports/progress-events";
import { createRecordImportRunner } from "~/server/records/imports/runner";

import { createIntegrationJobRepo } from "../infrastructure/integration-job-repo";
import type {
  ImportJobProcessResult,
  IntegrationJobRow,
  IntegrationRuntime,
} from "../types";

interface RecordImportRunner {
  process(
    job: IntegrationJobRow,
    context: JobContext,
  ): Promise<ImportJobProcessResult>;
}

interface RecordsImportQueueDeps {
  runtime: IntegrationRuntime;
  readFile: (filePath: string) => Promise<Uint8Array>;
  runner?: RecordImportRunner;
}

export function createRecordsImportQueue(
  workerId: string,
  deps: RecordsImportQueueDeps,
) {
  const leaseMs = 30_000;
  const { runtime } = deps;

  const runner =
    deps.runner ??
    createRecordImportRunner({
      executor: runtime.executor,
      readFile: deps.readFile,
      reportProgress: async (jobId, progress) => {
        await runtime.executor.transaction().execute(async (trx) => {
          const transactionRepo = createIntegrationJobRepo(trx);
          const persisted = await transactionRepo.updateProgress(
            jobId,
            progress,
          );
          await publishJobEvent(trx, buildRecordImportJobEvent(persisted));
        });
      },
    });

  return createJobQueue<IntegrationJobRow>({
    name: "records-import",
    leaseMs,
    workerId,
    store: runtime.jobs.store,

    handle: async (job, context) => {
      const result = await runner.process(job, context);

      // The queue store writes queue_state and completed_at.
      return {
        kind: "done",
        patch: {
          rows_total: result.rowsTotal,
          rows_applied: result.rowsApplied,
          rows_failed: result.rowsFailed,
          results_json: result.resultsJson,
        },
      };
    },

    onSettled: async (job) => {
      const settled = await runtime.jobs.findById(job.id);

      if (!settled) {
        return;
      }

      // An import writes statuses or priorities onto leads, so the list behind
      // it is stale once the run finishes.
      await publishJobEvent(
        runtime.executor,
        buildRecordImportJobEvent(settled, [QUERY_KEYS.workflow.leadList]),
      );
    },
  });
}
