import {
  hydrateRuc,
  type Document,
  type Ruc,
} from "~/domain/identity/document";
import { createSunatScraperClient } from "~/server/client-search/enrichment/sunat/client";
import { createCompanyRegistryRepo } from "~/server/client-search/repository";
import { createEnrichmentCommand } from "~/server/client-search/request";
import { createEnrichmentQuery } from "~/server/client-search/status";
import { createEnrichmentQueue } from "~/server/client-search/worker";
import type { ServerInfrastructure } from "~/server/platform/infrastructure";
import type { OperationContext } from "~/server/platform/operation/context";

import { buildEnrichmentJobEvent } from "./job-event";

// Function properties, not method shorthand: the queue receives these unbound,
// so a `this`-carrying signature would be a lie.
export interface ClientSearchRuntimeDeps {
  fallbackOrganizationEnrichment: (ruc: string) => Promise<{
    legalName: string | null;
    address: string | null;
  } | null>;
  projectOrganization: (input: {
    ruc: string;
    legalName: string | null;
    address: string | null;
    district: string | null;
    department: string | null;
  }) => Promise<void>;
}

export function createClientSearchRuntime(
  serverInfrastructure: ServerInfrastructure,
  deps: ClientSearchRuntimeDeps,
) {
  const registry = createCompanyRegistryRepo(serverInfrastructure.db);
  const scraper = createSunatScraperClient();
  const enrichmentCommand = createEnrichmentCommand(registry);
  const enrichmentQuery = createEnrichmentQuery(registry);

  return {
    requestEnrichment: (
      document: Document,
      requestedByUserId: string | null,
      operation: OperationContext,
    ) =>
      enrichmentCommand.enqueueRequest(document, requestedByUserId, operation),
    getEnrichmentStatus: (document: Document, operation: OperationContext) =>
      enrichmentQuery.getStatus(document, operation.operationAt),

    // Freshness is irrelevant to a subscriber: it is watching the scrape, not
    // deciding whether to start one, so the clock passed here does not matter.
    getEnrichmentJobEvent: async (ruc: Ruc) =>
      buildEnrichmentJobEvent(
        await enrichmentQuery.getStatus(
          { kind: "ruc", value: ruc },
          new Date(),
        ),
      ),

    createEnrichmentQueue: (workerId: string) =>
      createEnrichmentQueue(workerId, {
        db: serverInfrastructure.db,
        registry,
        scraper,
        engineFallback: deps.fallbackOrganizationEnrichment,
        projectOrganization: deps.projectOrganization,
        readStatus: (ruc) =>
          enrichmentQuery.getStatus(
            { kind: "ruc", value: hydrateRuc(ruc) },
            new Date(),
          ),
      }),
  };
}
