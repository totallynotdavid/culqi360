import type { EnrichmentLifecycle } from "~/contracts/client-search/enrichment";
import type { DocumentKind } from "~/domain/identity/document";

import type { SunatEconomicActivity } from "./enrichment/sunat/contracts";

type Freshness = "fresh" | "stale" | "none";

// `source` records which provider supplied the result: 'sunat' is
// authoritative; 'engine' is the degraded fallback written only when SUNAT
// was unreachable (legal name + address only).
export interface Overlay {
  documentType: DocumentKind;
  documentValue: string;
  fullName: string | null;
  legalName: string | null;
  address: string | null;
  district: string | null;
  department: string | null;
  contributorStatus: string | null;
  contributorCondition: string | null;
  economicActivities: SunatEconomicActivity[];
  source: "sunat" | "engine";
  fetchedAt: Date;
  expiresAt: Date;
  payload: unknown;
}

export interface EnrichmentStatus {
  documentType: DocumentKind;
  documentValue: string;
  lifecycle: EnrichmentLifecycle;
  freshness: Freshness;
  overlay: Overlay | null;
  lastError: string | null;
  requestedAt: Date | null;
}

export type EnrichmentError =
  | { kind: "not_found" }
  | { kind: "server_error"; detail?: string }
  | { kind: "timeout" }
  | { kind: "malformed_response"; detail?: string }
  | { kind: "invalid_document"; message: string };

export type ProcessResult =
  | { ok: true; overlay: Overlay }
  | { ok: false; error: EnrichmentError; shouldRetry: boolean };
