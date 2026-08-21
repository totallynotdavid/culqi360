import type { Accessor } from "solid-js";

import { createJob } from "~/browser/jobs/create-job";
import { parseEnrichmentJobDetail } from "~/contracts/client-search/enrichment";
import { JOB_KINDS } from "~/contracts/jobs/job-event";

/**
 * Follows the SUNAT scrape behind a record while it is still running.
 *
 * The settling frame carries the reads it invalidated, so the record refreshes
 * itself. Nothing here decides when to stop asking, because nothing here is
 * asking: this replaced a poll loop that revalidated the lead detail every few
 * seconds and needed a controller, a timeout, and an effect to know when to run.
 */
export function useEnrichmentWatch(ruc: Accessor<string | undefined>) {
  return createJob({
    kind: JOB_KINDS.clientEnrichment,
    subjectId: () => ruc() ?? null,
    parseDetail: parseEnrichmentJobDetail,
  });
}
