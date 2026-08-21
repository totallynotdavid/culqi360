import type { GpvSnapshotState } from "~/domain/merchant-stats/snapshot";

/**
 * A snapshot's settled shape: what it is, not how far along it is.
 *
 * Progress belongs to the import job and arrives over the job channel, so
 * nothing here changes while rows are being applied. The server revalidates this
 * read when the job settles.
 */
export interface GpvSnapshotView {
  snapshotId: string;
  state: GpvSnapshotState;
  cutAt: string;
  jobError: string | null;
  issues: readonly {
    id: string;
    type: string;
    detail: string;
    entityKey: string | null;
  }[];
}

/**
 * What the snapshot became, once the import knows.
 *
 * Null while rows are still being applied: a running import has no outcome yet,
 * and the envelope's queue state is what describes it until then.
 */
export interface GpvSnapshotDetail {
  snapshotState: GpvSnapshotState | null;
}

const GPV_SNAPSHOT_STATES: readonly GpvSnapshotState[] = [
  "queued",
  "processing",
  "needs_review",
  "ready",
  "active",
  "superseded",
  "rejected",
  "failed",
];

export function parseGpvSnapshotDetail(
  value: unknown,
): GpvSnapshotDetail | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  if (!("snapshotState" in value)) {
    return null;
  }

  const { snapshotState } = value;

  if (snapshotState === null) {
    return { snapshotState: null };
  }

  const known = GPV_SNAPSHOT_STATES.find(
    (candidate) => candidate === snapshotState,
  );

  return known === undefined ? null : { snapshotState: known };
}
