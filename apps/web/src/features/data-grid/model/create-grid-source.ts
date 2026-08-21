import { createMemo } from "solid-js";

import type { DataGridSource } from "./source";

export type GridSource<TData, TRow> = {
  source: () => DataGridSource<TRow>;
  data: () => TData;
};

/**
 * Projects an async query into grid rows.
 *
 * The promise enters the reactive graph on creation, so both accessors read a
 * plain settled value. Readiness and failure belong to the `Loading` and
 * `Errored` boundaries the page puts around the grid, which is why nothing here
 * catches or reports either.
 */
export function createGridSource<TData, TRow>(
  fetcher: () => Promise<TData>,
  project: (data: TData) => {
    rows: readonly TRow[];
    totalCount?: number;
  },
): GridSource<TData, TRow> {
  const data = createMemo(() => fetcher());

  // Memoized like the read above it: the grid reads the source from several
  // places per render, and projecting thousands of rows on each of those was
  // work nobody asked for.
  const source = createMemo<DataGridSource<TRow>>(() => {
    const projected = project(data());

    return {
      rows: projected.rows,
      totalCount: projected.totalCount ?? projected.rows.length,
    };
  });

  return { source, data };
}
