import { action } from "@solidjs/router";
import { respond } from "@solidjs/web";

import type { SearchIntent } from "~/contracts/search/vocabulary";
import { mySearchAllowanceQuery } from "~/rpc/capacity/my-search-allowance";
import { searchDirect } from "~/rpc/search/run";

export const searchDirectMutation = action(
  async (input: { intent: SearchIntent; query: string; limit: number }) =>
    respond(await searchDirect(input), {
      revalidate: [mySearchAllowanceQuery.key],
    }),
  "searchDirect",
);
