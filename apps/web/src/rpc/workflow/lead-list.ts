import { query } from "@solidjs/router";

import { QUERY_KEYS } from "~/contracts/query-keys";
import type { ListLeadsFiltersInput } from "~/contracts/workflow/inputs";
import { queryLeadList } from "~/server/workflow/ui/records";

export const leadListQuery = query(async (filters: ListLeadsFiltersInput) => {
  "use server";
  return queryLeadList(filters);
}, QUERY_KEYS.workflow.leadList);
