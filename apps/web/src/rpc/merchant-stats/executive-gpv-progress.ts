import { query } from "@solidjs/router";

import { QUERY_KEYS } from "~/contracts/query-keys";
import { getExecutiveGpvProgress } from "~/server/merchant-stats/ui/executive-progress";

export const executiveGpvProgressQuery = query(async () => {
  "use server";
  return getExecutiveGpvProgress();
}, QUERY_KEYS.merchantStats.executiveProgress);
