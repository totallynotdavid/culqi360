import { query } from "@solidjs/router";

import { QUERY_KEYS } from "~/contracts/query-keys";
import { getFilterOptions } from "~/server/merchant-stats/ui/dashboard";

export const merchantFilterOptionsQuery = query(async () => {
  "use server";
  return getFilterOptions();
}, QUERY_KEYS.merchantStats.filterOptions);
