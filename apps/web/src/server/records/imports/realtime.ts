import { JOB_KINDS } from "~/contracts/jobs/job-event";
import { hasPermission } from "~/domain/auth/access/rbac";
import { IntegrationJobId } from "~/domain/ids";
import { defineJobProjector } from "~/server/jobs/projector";
import { isErr } from "~/shared/result";

import { buildRecordImportJobEvent } from "./progress-events";
import type { createRecordImportsRuntime } from "./runtime";

export function createRecordImportProjector(
  recordImports: Pick<
    ReturnType<typeof createRecordImportsRuntime>,
    "find" | "canAccess"
  >,
) {
  return defineJobProjector({
    kind: JOB_KINDS.recordImport,

    parseSubjectId: (raw) => {
      const parsed = IntegrationJobId.parse(raw);

      return isErr(parsed) ? null : parsed.value;
    },

    // The job provides both access control and the opening state.
    read: async (session, jobId) => {
      if (!hasPermission(session.role, "integration:manage")) {
        return null;
      }

      const job = await recordImports.find(jobId);

      if (!job) {
        return null;
      }

      const canAccess = await recordImports.canAccess(
        {
          userId: session.userId,
          branchId: session.branchId,
          role: session.role,
        },
        job,
      );

      return canAccess ? buildRecordImportJobEvent(job) : null;
    },
  });
}
