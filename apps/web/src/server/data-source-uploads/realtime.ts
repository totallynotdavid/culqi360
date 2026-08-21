import { JOB_KINDS } from "~/contracts/jobs/job-event";
import { hasPermission } from "~/domain/auth/access/rbac";
import { defineJobProjector } from "~/server/jobs/projector";
import { isErr } from "~/shared/result";

import { buildIngestJobEvent } from "./job-bridge";
import type { createDataSourceUploadsRuntime } from "./runtime";

export function createIngestJobProjector(
  uploads: Pick<ReturnType<typeof createDataSourceUploadsRuntime>, "getJob">,
) {
  return defineJobProjector({
    kind: JOB_KINDS.dataSourceIngest,

    // Engine job ids are opaque to this app, so the only check that can be made
    // here is that the caller sent something.
    parseSubjectId: (raw) => (raw.length > 0 ? raw : null),

    read: async (session, jobId) => {
      if (!hasPermission(session.role, "data-source:import")) {
        return null;
      }

      const job = await uploads.getJob(jobId);

      return isErr(job) ? null : buildIngestJobEvent(job.value);
    },
  });
}
