import { createMemo } from "solid-js";
import type { Accessor } from "solid-js";

import type { FilterOptions } from "~/contracts/merchant-stats/views";
import { merchantFilterOptionsQuery } from "~/rpc/merchant-stats/merchant-filter-options";

const EMPTY_OPTIONS: FilterOptions = {
  branches: [],
  sellers: [],
  months: [],
  products: [],
};

export function useFilterOptions(): Accessor<FilterOptions> {
  const options = createMemo(() => merchantFilterOptionsQuery());
  return () => options() ?? EMPTY_OPTIONS;
}
