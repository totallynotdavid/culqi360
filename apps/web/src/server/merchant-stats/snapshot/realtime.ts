import { JOB_KINDS } from "~/contracts/jobs/job-event";
import { hasPermission } from "~/domain/auth/access/rbac";
import { GpvSnapshotId } from "~/domain/ids";
import { defineJobProjector } from "~/server/jobs/projector";
import { isErr } from "~/shared/result";

import type { createMerchantStatsRuntime } from "../infrastructure/runtime";

export function createGpvSnapshotProjector(
  merchantStats: Pick<ReturnType<typeof createMerchantStatsRuntime>, "imports">,
) {
  return defineJobProjector({
    kind: JOB_KINDS.gpvSnapshot,

    parseSubjectId: (raw) => {
      const parsed = GpvSnapshotId.parse(raw);

      return isErr(parsed) ? null : parsed.value;
    },

    read: async (session, snapshotId) =>
      hasPermission(session.role, "dashboards:read")
        ? merchantStats.imports.jobEvent(snapshotId)
        : null,
  });
}
