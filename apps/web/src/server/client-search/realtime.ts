import { JOB_KINDS } from "~/contracts/jobs/job-event";
import { hasPermission } from "~/domain/auth/access/rbac";
import { parseRuc } from "~/domain/identity/document";
import { defineJobProjector } from "~/server/jobs/projector";
import { isErr } from "~/shared/result";

import type { createClientSearchRuntime } from "./runtime";

export function createEnrichmentProjector(
  clientSearch: Pick<
    ReturnType<typeof createClientSearchRuntime>,
    "getEnrichmentJobEvent"
  >,
) {
  return defineJobProjector({
    kind: JOB_KINDS.clientEnrichment,

    parseSubjectId: (raw) => {
      const parsed = parseRuc(raw);

      return isErr(parsed) ? null : parsed.value;
    },

    read: async (session, ruc) =>
      hasPermission(session.role, "search:use")
        ? clientSearch.getEnrichmentJobEvent(ruc)
        : null,
  });
}
