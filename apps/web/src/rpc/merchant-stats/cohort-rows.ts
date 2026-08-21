import { query } from "@solidjs/router";

import type { BookFilter, Page } from "~/contracts/merchant-stats/views";
import { QUERY_KEYS } from "~/contracts/query-keys";
import { getCohortRows } from "~/server/merchant-stats/ui/dashboard";

export const cohortRowsQuery = query(
  async (input: { filter: BookFilter; page: Page }) => {
    "use server";
    return getCohortRows(input);
  },
  QUERY_KEYS.merchantStats.cohortRows,
);
