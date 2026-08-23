// rpc/data-sources/ingest.ts's declared return types catch a field going
// missing here, not one added only on the server side.

export type IngestJobStep =
  | "queued"
  | "staging"
  | "gating"
  | "merging"
  | "validating"
  | "materializing"
  | "complete";

export type IngestJobOutcome = "running" | "succeeded" | "failed";

export interface IngestGateCheck {
  name: string;
  passed: boolean;
  actual: number;
  threshold: number;
  message: string;
}

export interface IngestGateResult {
  passed: boolean;
  checks: IngestGateCheck[];
}

export interface IngestJob {
  job_id: string;
  source_key: string;
  snapshot_label: string;
  step: IngestJobStep;
  outcome: IngestJobOutcome;
  snapshot_id: number | null;
  total_rows: number | null;
  accepted_rows: number | null;
  invalid_doc_rows: number | null;
  gate: IngestGateResult | null;
  error: string | null;
  created_at: number;
  updated_at: number;
}

export interface IngestSource {
  source_key: string;
  source_name: string;
}

/** The kind-specific half of an ingest job's live state. */
export interface IngestJobDetail {
  step: IngestJobStep;
  sourceKey: string;
  gate: IngestGateResult | null;
}

const INGEST_JOB_STEPS: readonly IngestJobStep[] = [
  "queued",
  "staging",
  "gating",
  "merging",
  "validating",
  "materializing",
  "complete",
];

function isGateResult(value: unknown): value is IngestGateResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "passed" in value &&
    typeof value.passed === "boolean" &&
    "checks" in value &&
    Array.isArray(value.checks)
  );
}

export function parseIngestJobDetail(value: unknown): IngestJobDetail | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("step" in value) ||
    !("sourceKey" in value) ||
    !("gate" in value)
  ) {
    return null;
  }

  const { step, sourceKey, gate } = value;
  const knownStep = INGEST_JOB_STEPS.find((candidate) => candidate === step);

  if (knownStep === undefined || typeof sourceKey !== "string") {
    return null;
  }

  return {
    step: knownStep,
    sourceKey,
    gate: isGateResult(gate) ? gate : null,
  };
}
