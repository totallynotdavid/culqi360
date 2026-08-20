import { action } from "@solidjs/router";
import { respond } from "@solidjs/web";

import { upsertAuditPolicy } from "~/rpc/admin/audit-policy";
import { auditPolicySnapshotQuery } from "~/rpc/audit-policies/audit-policy-snapshot";

export const upsertAuditPolicyMutation = action(
  async (input: { action: string; riskLevel: string; isActive: boolean }) => {
    await upsertAuditPolicy(input);
    return respond({}, { revalidate: auditPolicySnapshotQuery.key });
  },
  "upsertAuditPolicy",
);
