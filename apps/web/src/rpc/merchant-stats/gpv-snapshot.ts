import { query } from "@solidjs/router";

import { QUERY_KEYS } from "~/contracts/query-keys";
import { getGpvSnapshot } from "~/server/merchant-stats/ui/imports";

export const gpvSnapshotQuery = query(async (snapshotId: string) => {
  "use server";
  return getGpvSnapshot(snapshotId);
}, QUERY_KEYS.merchantStats.gpvSnapshot);
