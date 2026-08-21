import { QUERY_KEYS } from "~/contracts/query-keys";
import type { SunatScraperClient } from "~/server/client-search/enrichment/sunat/contracts";
import type { EnrichmentStatus, Overlay } from "~/server/client-search/model";
import type {
  CompanyRegistryPort,
  OrganizationProjection,
  RegistryRow,
} from "~/server/client-search/ports";
import {
  processEnrichmentJob,
  overlayToPatch,
} from "~/server/client-search/process";
import { publishJobEvent } from "~/server/jobs/publish";
import type { DatabaseExecutor } from "~/server/platform/database/executor";
import { createJobQueue } from "~/server/platform/jobs/job-queue";

import { buildEnrichmentJobEvent } from "./job-event";

// SUNAT-unreachable fallback: supplies legal name + address only. The
// degraded record expires quickly so the next refresh re-attempts the
// authoritative scrape.
type EngineFallback = (
  ruc: string,
) => Promise<{ legalName: string | null; address: string | null } | null>;

type EnrichmentWorkerDeps = {
  db: DatabaseExecutor;
  registry: CompanyRegistryPort;
  scraper: SunatScraperClient;
  engineFallback: EngineFallback;
  projectOrganization: (input: OrganizationProjection) => Promise<void>;
  readStatus: (ruc: string) => Promise<EnrichmentStatus>;
};

const DEGRADED_TTL_MS = 60 * 60 * 1000; // 1 hour

export function createEnrichmentQueue(
  workerId: string,
  deps: EnrichmentWorkerDeps,
) {
  const { registry, scraper, engineFallback, projectOrganization } = deps;

  async function project(overlay: Overlay): Promise<void> {
    if (overlay.documentType !== "ruc") {
      return;
    }
    await projectOrganization({
      ruc: overlay.documentValue,
      legalName: overlay.legalName,
      address: overlay.address,
      district: overlay.district,
      department: overlay.department,
    });
  }

  async function fallbackOverlay(job: RegistryRow): Promise<Overlay | null> {
    if (job.document_type !== "ruc") {
      return null;
    }
    const hit = await engineFallback(job.document_value);
    if (!hit) {
      return null;
    }
    // The Engine response is an external observation, not a consequence of
    // claiming this job. Its freshness window starts when that response is
    // received, so a slow fallback cannot be stored as already stale.
    const fetchedAt = new Date(); // clock-boundary: external engine observation
    return {
      documentType: "ruc",
      documentValue: job.document_value,
      fullName: null,
      legalName: hit.legalName,
      address: hit.address,
      district: null,
      department: null,
      contributorStatus: null,
      contributorCondition: null,
      economicActivities: [],
      source: "engine",
      fetchedAt,
      expiresAt: new Date(fetchedAt.getTime() + DEGRADED_TTL_MS),
      payload: null,
    };
  }

  return createJobQueue<RegistryRow>({
    name: "enrichment",
    leaseMs: 30_000,
    maxConcurrency: 3,
    workerId,
    store: registry.store,

    // A settled scrape rewrites the organization behind every lead on this
    // document, so both reads that show it are stale.
    onSettled: async (job) => {
      if (job.document_type !== "ruc") {
        return;
      }

      const status = await deps.readStatus(job.document_value);

      await publishJobEvent(
        deps.db,
        buildEnrichmentJobEvent(status, [
          QUERY_KEYS.workflow.leadDetail,
          QUERY_KEYS.workflow.leadList,
        ]),
      );
    },

    handle: async (job, context) => {
      const result = await processEnrichmentJob(
        job,
        scraper,
        context.abortSignal,
      );

      if (result.ok) {
        // Result columns ride the engine's settle. The org projection is an
        // inline idempotent local write: a projection failure rethrows, so the
        // job retries and re-projects.
        await project(result.overlay);
        return { kind: "done", patch: overlayToPatch(result.overlay) };
      }

      // SUNAT has no record: settle done with no result.
      if (result.error.kind === "not_found") {
        return { kind: "done" };
      }

      const exhausted = job.attempt_count >= job.max_attempts;
      if (result.shouldRetry && !exhausted) {
        return { kind: "retry", reason: `enrichment:${result.error.kind}` };
      }

      // Engine fallback so the record is not left empty; a miss (or a DNI) is
      // a terminal failure.
      const fallback = await fallbackOverlay(job);
      if (fallback) {
        await project(fallback);
        return { kind: "done", patch: overlayToPatch(fallback) };
      }
      return { kind: "fail", reason: `enrichment:${result.error.kind}` };
    },
  });
}
