import { PUBLISHED_GPV_KEYS, QUERY_KEYS } from "~/contracts/query-keys";
import { publishJobEvent } from "~/server/jobs/publish";
import type { DatabaseExecutor } from "~/server/platform/database/executor";
import { createJobQueue } from "~/server/platform/jobs/job-queue";

import { buildGpvSnapshotJobEvent } from "./progress";
import { createGpvSnapshotJobRepo, type GpvSnapshotJobRow } from "./repo";
import { createGpvSnapshotRunner, type GpvSnapshotRunner } from "./runner";

interface GpvSnapshotQueueDeps {
  db: DatabaseExecutor;
  readFile: (storageKey: string) => Promise<Uint8Array>;
  runner?: GpvSnapshotRunner;
}

export function createGpvSnapshotQueue(
  workerId: string,
  deps: GpvSnapshotQueueDeps,
) {
  const repo = createGpvSnapshotJobRepo(deps.db);
  const runner =
    deps.runner ??
    createGpvSnapshotRunner({
      db: deps.db,
      readFile: deps.readFile,
      reportProgress: async (id, progress) => {
        await deps.db.transaction().execute(async (trx) => {
          const transactionRepo = createGpvSnapshotJobRepo(trx);
          const persisted = await transactionRepo.updateProgress(id, progress);
          await publishJobEvent(trx, buildGpvSnapshotJobEvent(persisted));
        });
      },
    });

  return createJobQueue<GpvSnapshotJobRow>({
    name: "gpv-snapshot-import",
    leaseMs: 60_000,
    workerId,
    store: repo.store,
    handle: async (job, context) => {
      const result = await runner.process(job, context);

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
      const settled = await repo.findById(job.id);

      if (!settled) {
        return;
      }
      if (settled.queue_state === "failed") {
        await deps.db
          .updateTable("gpv_snapshots")
          .set({ state: "failed" })
          .where("id", "=", settled.snapshot_id)
          .where("state", "in", ["queued", "processing"])
          .execute();
      }

      const snapshot = await deps.db
        .selectFrom("gpv_snapshots")
        .select("state")
        .where("id", "=", settled.snapshot_id)
        .executeTakeFirstOrThrow();

      // A finished import always changes the snapshot itself, and changes every
      // dashboard behind it only when the snapshot went live. Saying so here is
      // what lets the browser stop inferring it from a state transition.
      const stale =
        snapshot.state === "active"
          ? [QUERY_KEYS.merchantStats.gpvSnapshot, ...PUBLISHED_GPV_KEYS]
          : [QUERY_KEYS.merchantStats.gpvSnapshot];

      await publishJobEvent(
        deps.db,
        buildGpvSnapshotJobEvent(settled, {
          snapshotState: snapshot.state,
          stale,
        }),
      );
    },
  });
}
