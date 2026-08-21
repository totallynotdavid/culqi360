/**
 * How far a document's SUNAT enrichment has got.
 *
 * On the wire because the browser watches it as a job: the record page shows a
 * pending badge until the scrape settles, and the settling frame is what tells it
 * the lead it is displaying has changed underneath.
 */
export type EnrichmentLifecycle =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

export interface EnrichmentJobDetail {
  lifecycle: EnrichmentLifecycle;
}

const ENRICHMENT_LIFECYCLES: readonly EnrichmentLifecycle[] = [
  "idle",
  "queued",
  "running",
  "succeeded",
  "failed",
];

export function parseEnrichmentJobDetail(
  value: unknown,
): EnrichmentJobDetail | null {
  if (typeof value !== "object" || value === null || !("lifecycle" in value)) {
    return null;
  }

  const lifecycle = ENRICHMENT_LIFECYCLES.find(
    (candidate) => candidate === value.lifecycle,
  );

  return lifecycle === undefined ? null : { lifecycle };
}
