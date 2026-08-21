import { query } from "@solidjs/router";

import { QUERY_KEYS } from "~/contracts/query-keys";
import { getMerchantStatsForRuc } from "~/server/merchant-stats/ui/org-stats";

export const merchantStatsByRucQuery = query(async (ruc: string) => {
  "use server";
  return getMerchantStatsForRuc(ruc);
}, QUERY_KEYS.merchantStats.byRuc);
