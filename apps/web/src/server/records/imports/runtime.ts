import { randomUUID } from "node:crypto";

import type { RecordImportType } from "~/contracts/records/imports";
import type { UserId } from "~/domain/ids";
import { createIntegrationJobRepo } from "~/server/integrations/infrastructure/integration-job-repo";
import { createRecordsImportQueue } from "~/server/integrations/queue/records-import-queue";
import type { IntegrationRuntime } from "~/server/integrations/types";
import { publishJobEvent } from "~/server/jobs/publish";
import type { BlobStore } from "~/server/platform/files/blob-store";

import { canAccessRecordImportJob } from "./api";
import { buildRecordImportJobEvent } from "./progress-events";

export function createRecordImportsRuntime(
  integration: IntegrationRuntime,
  storage: BlobStore,
) {
  return {
    async create(input: {
      type: RecordImportType;
      requestedByUserId: UserId;
      rowsTotal: number;
      payload: Uint8Array;
      createdAt: Date;
    }) {
      const storageKey = `imports/${randomUUID()}.json`;
      await storage.putBytes(storageKey, input.payload);

      return integration.executor.transaction().execute(async (trx) => {
        const jobs = createIntegrationJobRepo(trx);
        const job = await jobs.insert({
          type: input.type,
          requested_by_user_id: input.requestedByUserId,
          file_path: storageKey,
          rows_total: input.rowsTotal,
          max_attempts: 3,
          created_at: input.createdAt,
        });
        await publishJobEvent(trx, buildRecordImportJobEvent(job));
        return job;
      });
    },
    find: (jobId: Parameters<typeof integration.jobs.findById>[0]) =>
      integration.jobs.findById(jobId),
    canAccess: (
      actor: Parameters<typeof canAccessRecordImportJob>[0],
      job: Parameters<typeof canAccessRecordImportJob>[1],
    ) => canAccessRecordImportJob(actor, job, integration),
    createQueue: (workerId: string) =>
      createRecordsImportQueue(workerId, {
        runtime: integration,
        readFile: (storageKey) => storage.getBytes(storageKey),
      }),
  };
}
