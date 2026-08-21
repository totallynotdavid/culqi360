import { query } from "@solidjs/router";

import type { BookFilter } from "~/contracts/merchant-stats/views";
import { QUERY_KEYS } from "~/contracts/query-keys";
import { getGpvPerformance } from "~/server/merchant-stats/ui/dashboard";

export const gpvPerformanceViewQuery = query(
  async (input: { filter: BookFilter }) => {
    "use server";
    return getGpvPerformance(input);
  },
  QUERY_KEYS.merchantStats.gpvPerformance,
);
