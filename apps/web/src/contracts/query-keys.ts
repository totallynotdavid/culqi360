/**
 * Query keys the server names when it invalidates client caches.
 *
 * A key that only the browser ever uses can stay a literal at its `query()`
 * registration. These are different: a job event carries them across the wire so
 * the side that knows what went stale is the side that says so, which makes the
 * string a contract rather than a private cache label.
 */
export const QUERY_KEYS = {
  merchantStats: {
    byRuc: "merchant-stats.by-ruc",
    cohortRows: "merchant-stats.cohort-rows",
    executiveProgress: "merchant-stats.executive-progress",
    filterOptions: "merchant-stats.filter-options",
    gpvCulqi: "merchant-stats.gpv-culqi",
    gpvPerformance: "merchant-stats.gpv-performance",
    gpvSnapshot: "merchant-stats.gpv-snapshot",
    qualityRows: "merchant-stats.quality-rows",
  },
  workflow: {
    leadDetail: "workflow.lead-detail",
    leadList: "workflow.lead-list",
  },
} as const;

/** Reads that show attributed GPV, and so move when credit is reassigned. */
export const ATTRIBUTED_GPV_KEYS = [
  QUERY_KEYS.merchantStats.byRuc,
  QUERY_KEYS.merchantStats.cohortRows,
  QUERY_KEYS.merchantStats.executiveProgress,
  QUERY_KEYS.merchantStats.gpvPerformance,
  QUERY_KEYS.merchantStats.qualityRows,
] as const;

/**
 * Everything a newly published snapshot changes. Wider than the attributed set:
 * publishing also introduces merchants the filter options have never listed.
 */
export const PUBLISHED_GPV_KEYS = [
  ...ATTRIBUTED_GPV_KEYS,
  QUERY_KEYS.merchantStats.filterOptions,
  QUERY_KEYS.merchantStats.gpvCulqi,
] as const;
