import { revalidate } from "@solidjs/router";

import { leadDetailQuery } from "~/rpc/workflow/lead-detail";
import { leadListQuery } from "~/rpc/workflow/lead-list";

// `revalidate` marks the query stale and returns. The refetch lands through the
// reactive graph, so callers do not wait on it.

export function revalidateWorkflowLeadList(): void {
  revalidate(leadListQuery.key);
}

/** Most lead mutations change a field the list column shows, so both refresh. */
export function revalidateWorkflowLead(leadId: string): void {
  revalidate(leadDetailQuery.keyFor(leadId));
  revalidateWorkflowLeadList();
}
