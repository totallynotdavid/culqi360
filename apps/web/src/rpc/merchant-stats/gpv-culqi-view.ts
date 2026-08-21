import { query } from "@solidjs/router";

import type { BookFilter } from "~/contracts/merchant-stats/views";
import { QUERY_KEYS } from "~/contracts/query-keys";
import { getGpvCulqi } from "~/server/merchant-stats/ui/dashboard";

export const gpvCulqiViewQuery = query(
  async (input: { filter: BookFilter }) => {
    "use server";
    return getGpvCulqi(input);
  },
  QUERY_KEYS.merchantStats.gpvCulqi,
);
