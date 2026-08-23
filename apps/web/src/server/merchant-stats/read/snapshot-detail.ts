import type { GpvSnapshotView } from "~/contracts/merchant-stats/imports";
import { fail, type DomainError } from "~/domain/errors";
import type { GpvSnapshotId } from "~/domain/ids";
import type { DatabaseExecutor } from "~/server/platform/database/executor";
import { Err, Ok, type Result } from "~/shared/result";

export async function getGpvSnapshotDetail(
  db: DatabaseExecutor,
  snapshotId: GpvSnapshotId,
): Promise<Result<GpvSnapshotView, DomainError>> {
  const snapshot = await db
    .selectFrom("gpv_snapshots as snapshot")
    .leftJoin("gpv_snapshot_jobs as job", "job.snapshot_id", "snapshot.id")
    .select([
      "snapshot.id",
      "snapshot.state",
      "snapshot.cut_at",
      "job.id as job_id",
      "job.queue_state",
      "job.rows_applied",
      "job.rows_failed",
      "job.rows_total",
      "job.error_message",
    ])
    .where("snapshot.id", "=", snapshotId)
    .executeTakeFirst();

  if (!snapshot) {
    return Err(fail("gpv_snapshot_not_found"));
  }

  const issues = await db
    .selectFrom("gpv_snapshot_issues")
    .select(["id", "issue_type", "detail", "entity_key"])
    .where("snapshot_id", "=", snapshotId)
    .where("severity", "=", "blocking")
    .where("status", "=", "open")
    .orderBy("created_at")
    .execute();

  return Ok({
    snapshotId: snapshot.id,
    state: snapshot.state,
    cutAt: snapshot.cut_at.toISOString(),
    jobError: snapshot.error_message,
    issues: issues.map((issue) => ({
      id: issue.id,
      type: issue.issue_type,
      detail: issue.detail,
      entityKey: issue.entity_key,
    })),
  });
}
