import { isQueueState, type QueueState } from "~/domain/jobs/queue-state";

/**
 * Server-side work a user waits on. Every kind streams the same envelope over
 * one realtime channel; `detail` carries what a given kind's view needs.
 *
 * The split matters: status, progress and error are what the machinery reads
 * (is it done, draw a bar, show a failure), and every kind answers them the same
 * way. Detail is what only one view understands. Sharing the first and not the
 * second is why this is one type rather than either three types or one type with
 * a union of every field any kind ever needed.
 */
export const JOB_KINDS = {
  gpvSnapshot: "gpv-snapshot",
  recordImport: "record-import",
  dataSourceIngest: "data-source-ingest",
  clientEnrichment: "client-enrichment",
} as const;

export type JobKind = (typeof JOB_KINDS)[keyof typeof JOB_KINDS];

export interface JobProgress {
  completed: number;
  failed: number;
  // Zero while the worker has not counted the input yet, which reads as
  // indeterminate rather than as an empty job.
  total: number;
}

export interface JobEvent<Detail = unknown> {
  kind: JobKind;

  /**
   * What the job is about, not which attempt is running: a snapshot id rather
   * than the id of the import currently processing it. Subscriptions survive a
   * retry, and a client that knows the entity can subscribe without first
   * discovering an attempt.
   */
  subjectId: string;

  state: QueueState;
  progress: JobProgress;
  errorMessage: string | null;
  detail: Detail;

  /**
   * Query keys this event invalidated, applied once by the client subscription.
   *
   * The server is the only side that knows a GPV snapshot going active makes
   * eleven dashboards stale, so it says so instead of leaving each screen to
   * infer it from a state transition it happened to be watching. Absent when the
   * event changed nothing outside the job itself.
   */
  stale?: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isJobKind(value: unknown): value is JobKind {
  return Object.values<unknown>(JOB_KINDS).includes(value);
}

function parseProgress(value: unknown): JobProgress | null {
  if (!isRecord(value)) {
    return null;
  }

  const { completed, failed, total } = value;

  if (
    typeof completed !== "number" ||
    typeof failed !== "number" ||
    typeof total !== "number"
  ) {
    return null;
  }

  return { completed, failed, total };
}

function parseStale(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.every((entry) => typeof entry === "string") ? value : undefined;
}

/**
 * Narrows a stream frame, delegating only the kind-specific part.
 *
 * The envelope is validated here for every kind so adding a job type costs a
 * detail guard rather than another copy of the same field-by-field check.
 */
export function parseJobEvent<Detail>(
  raw: string,
  parseDetail: (value: unknown) => Detail | null,
): JobEvent<Detail> | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  const progress = parseProgress(parsed.progress);
  const detail = parseDetail(parsed.detail);

  if (
    !isJobKind(parsed.kind) ||
    typeof parsed.subjectId !== "string" ||
    !isQueueState(parsed.state) ||
    progress === null ||
    detail === null ||
    !(typeof parsed.errorMessage === "string" || parsed.errorMessage === null)
  ) {
    return null;
  }

  return {
    kind: parsed.kind,
    subjectId: parsed.subjectId,
    state: parsed.state,
    progress,
    errorMessage: parsed.errorMessage,
    detail,
    stale: parseStale(parsed.stale),
  };
}

export function isJobSettled(event: JobEvent): boolean {
  return event.state === "done" || event.state === "failed";
}

/**
 * The routing half of a frame, readable without knowing the kind's detail type.
 *
 * The broadcaster only needs to know which subscription a payload belongs to, so
 * it must not have to pick a detail parser to find out.
 */
export function parseJobRoute(
  raw: string,
): { kind: JobKind; subjectId: string } | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || !isJobKind(parsed.kind)) {
    return null;
  }

  return typeof parsed.subjectId === "string"
    ? { kind: parsed.kind, subjectId: parsed.subjectId }
    : null;
}

/** Subscriptions share one channel, so the kind travels in the id. */
export function jobSubscriptionId(kind: JobKind, subjectId: string): string {
  return `${kind}:${subjectId}`;
}

export function parseJobSubscriptionId(
  raw: string,
): { kind: JobKind; subjectId: string } | null {
  const separator = raw.indexOf(":");

  if (separator === -1) {
    return null;
  }

  const kind = raw.slice(0, separator);
  const subjectId = raw.slice(separator + 1);

  return isJobKind(kind) && subjectId.length > 0 ? { kind, subjectId } : null;
}
