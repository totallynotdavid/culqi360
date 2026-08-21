import { query } from "@solidjs/router";

import { QUERY_KEYS } from "~/contracts/query-keys";
import { queryLeadDetail } from "~/server/workflow/ui/records";

export const leadDetailQuery = query(async (leadId: string) => {
  "use server";
  return queryLeadDetail(leadId);
}, QUERY_KEYS.workflow.leadDetail);
