import { query } from "@solidjs/router";

import type { Page } from "~/contracts/merchant-stats/views";
import type { QualityIssue } from "~/contracts/merchant-stats/vocabulary";
import { QUERY_KEYS } from "~/contracts/query-keys";
import { getQualityRows } from "~/server/merchant-stats/ui/quality";

export const qualityRowsQuery = query(
  async (input: { issue: QualityIssue; page: Page }) => {
    "use server";
    return getQualityRows(input);
  },
  QUERY_KEYS.merchantStats.qualityRows,
);
