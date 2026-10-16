export const EXTENSION_HANDOFF_TOKEN_ISSUER = "web" as const;
export const EXTENSION_HANDOFF_TOKEN_AUDIENCE = "crm-extension" as const;

/**
 * Claims of the handoff token the web app signs and the extension parses.
 * Every id is a database uuid, so it travels as a string.
 */
export interface ExtensionHandoffClaims {
  iss: typeof EXTENSION_HANDOFF_TOKEN_ISSUER;
  aud: typeof EXTENSION_HANDOFF_TOKEN_AUDIENCE;
  sub: `user:${string}`;
  authSessionId: string;
  branchId: string;
  assignmentId: string;
  contactId: string;
  phone: string;
  clientName: string | null;
  organizationLabel: string | null;
  action: "start_call";
  origin: string;
  jti: string;
  iat: number;
  exp: number;
}

export const EXTENSION_PRESENCE_STATUSES = [
  "idle",
  "ready",
  "dialing",
  "active",
  "wrap_up",
] as const;

export const EXTENSION_SYNC_HEALTH_STATUSES = [
  "ok",
  "pending",
  "error",
  "reauth_required",
] as const;

export type ExecutivePresenceStatus =
  (typeof EXTENSION_PRESENCE_STATUSES)[number];

export type SyncHealth = (typeof EXTENSION_SYNC_HEALTH_STATUSES)[number];

export interface ExecutiveStateSnapshot {
  presenceStatus: ExecutivePresenceStatus;
  syncHealth: SyncHealth;
  assignmentId: string | null;
  contactId: string | null;
  phone: string | null;
  presenceUpdatedAt: number | null;
  syncUpdatedAt: number | null;
}

/**
 * The `event` of a `call.metric` job. `microphone_lost` says the agent's
 * microphone track ended mid-call, so the recording holds only the tab.
 */
export type ExtensionCallMetricEvent =
  | "between_calls"
  | "duration"
  | "microphone_lost";

export interface StateGetMessage {
  type: "state.get";
}

export interface AssignmentHandoffMessage {
  type: "assignment.handoff";
  token: string;
}

export type ExternalRuntimeMessage = StateGetMessage | AssignmentHandoffMessage;

export interface BridgeSuccessResponse {
  ok: true;
  executiveState: ExecutiveStateSnapshot;
}

export interface BridgeErrorResponse {
  ok: false;
  error: string;
  executiveState?: ExecutiveStateSnapshot;
}

export type BridgeResponse = BridgeSuccessResponse | BridgeErrorResponse;

/**
 * `callId` is minted by the server when the handoff is claimed. A re-claim of
 * the same handoff returns the same call.
 */
export interface ClaimExtensionSessionResponse {
  sessionToken: string;
  refreshToken: string;
  expiresAt: number;
  callId: string;
}

/** A refresh rotates both tokens and keeps the call the claim opened. */
export type RefreshExtensionSessionResponse = Omit<
  ClaimExtensionSessionResponse,
  "callId"
>;

export const EXTENSION_SESSION_CLAIM_PATH = "/api/extension/session/claim";
export const EXTENSION_SESSION_REFRESH_PATH = "/api/extension/session/refresh";
export const EXTENSION_EVENTS_PATH = "/api/extension/events";

/*
 * Call recording upload. The server mints every id (`callId` at claim,
 * `recordingId` at recording creation) and the extension never invents one.
 * All routes take `Authorization: Bearer <sessionToken>`, and an id minted for
 * one installation session is invisible (404) to any other.
 */

export const EXTENSION_RECORDINGS_PATH = "/api/extension/recordings";

export function recordingSegmentPath(recordingId: string, seq: number): string {
  return `${EXTENSION_RECORDINGS_PATH}/${recordingId}/segments/${seq}`;
}

export function recordingClosePath(recordingId: string): string {
  return `${EXTENSION_RECORDINGS_PATH}/${recordingId}/close`;
}

/** Segment request headers. `Content-Type` carries the codec (`audio/*`). */
export const EXTENSION_SEGMENT_CHANNELS_HEADER = "x-channels";
/** Epoch milliseconds at which the segment's audio starts. */
export const EXTENSION_SEGMENT_STARTED_AT_HEADER = "x-started-at";
export const EXTENSION_SEGMENT_CHANNEL_LAYOUT = "mic-left,tab-right";

export const EXTENSION_SEGMENT_MAX_BYTES = 4 * 1024 * 1024;
/** About 27 hours of 1 s segments. */
export const EXTENSION_RECORDING_MAX_SEGMENTS = 100_000;

export interface CreateRecordingRequest {
  callId: string;
}

export interface CreateRecordingResponse {
  recordingId: string;
}

/** `sizeBytes` is what the server stored for this `seq`. */
export interface UploadSegmentResponse {
  seq: number;
  sizeBytes: number;
}

/**
 * `segments` is the count of segments 0..n-1 and `bytes` their total size.
 * `interrupted` says the recording ended early (tab closed, call dropped).
 */
export interface CloseRecordingRequest {
  segments: number;
  bytes: number;
  interrupted: boolean;
}

/**
 * Only `complete` means the server holds segments 0..n-1 with the manifest's
 * total size. The extension may delete its local audio on nothing else, and a
 * bare 2xx on a segment is not proof.
 */
export type CloseRecordingResponse =
  | { status: "complete"; segments: number; bytes: number }
  | { status: "missing"; missing: number[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isExecutivePresenceStatus(
  value: unknown,
): value is ExecutivePresenceStatus {
  return (
    typeof value === "string" &&
    EXTENSION_PRESENCE_STATUSES.includes(value as ExecutivePresenceStatus)
  );
}

export function isSyncHealth(value: unknown): value is SyncHealth {
  return (
    typeof value === "string" &&
    EXTENSION_SYNC_HEALTH_STATUSES.includes(value as SyncHealth)
  );
}

export function isExecutiveStateSnapshot(
  value: unknown,
): value is ExecutiveStateSnapshot {
  return (
    isRecord(value) &&
    isExecutivePresenceStatus(value.presenceStatus) &&
    isSyncHealth(value.syncHealth) &&
    (value.assignmentId === null || typeof value.assignmentId === "string") &&
    (value.contactId === null || typeof value.contactId === "string") &&
    (value.phone === null || typeof value.phone === "string") &&
    (value.presenceUpdatedAt === null ||
      typeof value.presenceUpdatedAt === "number") &&
    (value.syncUpdatedAt === null || typeof value.syncUpdatedAt === "number")
  );
}

export function isExtensionHandoffClaims(
  value: unknown,
): value is ExtensionHandoffClaims {
  return (
    isRecord(value) &&
    value.iss === EXTENSION_HANDOFF_TOKEN_ISSUER &&
    value.aud === EXTENSION_HANDOFF_TOKEN_AUDIENCE &&
    typeof value.sub === "string" &&
    value.sub.startsWith("user:") &&
    typeof value.authSessionId === "string" &&
    typeof value.branchId === "string" &&
    typeof value.assignmentId === "string" &&
    typeof value.contactId === "string" &&
    typeof value.phone === "string" &&
    (value.clientName === null || typeof value.clientName === "string") &&
    (value.organizationLabel === null ||
      typeof value.organizationLabel === "string") &&
    value.action === "start_call" &&
    typeof value.origin === "string" &&
    typeof value.jti === "string" &&
    typeof value.iat === "number" &&
    typeof value.exp === "number"
  );
}

export function isExternalRuntimeMessage(
  value: unknown,
): value is ExternalRuntimeMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "state.get":
      return true;
    case "assignment.handoff":
      return typeof value.token === "string";
    default:
      return false;
  }
}

export function isBridgeResponse(value: unknown): value is BridgeResponse {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return false;
  }

  if (value.ok) {
    return isExecutiveStateSnapshot(value.executiveState);
  }

  return (
    typeof value.error === "string" &&
    (value.executiveState === undefined ||
      isExecutiveStateSnapshot(value.executiveState))
  );
}

function isSegmentIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isClaimExtensionSessionResponse(
  value: unknown,
): value is ClaimExtensionSessionResponse {
  return (
    isRecord(value) &&
    typeof value.sessionToken === "string" &&
    typeof value.refreshToken === "string" &&
    typeof value.expiresAt === "number" &&
    typeof value.callId === "string"
  );
}

export function isRefreshExtensionSessionResponse(
  value: unknown,
): value is RefreshExtensionSessionResponse {
  return (
    isRecord(value) &&
    typeof value.sessionToken === "string" &&
    typeof value.refreshToken === "string" &&
    typeof value.expiresAt === "number"
  );
}

export function isCreateRecordingRequest(
  value: unknown,
): value is CreateRecordingRequest {
  return isRecord(value) && typeof value.callId === "string";
}

export function isCreateRecordingResponse(
  value: unknown,
): value is CreateRecordingResponse {
  return isRecord(value) && typeof value.recordingId === "string";
}

export function isUploadSegmentResponse(
  value: unknown,
): value is UploadSegmentResponse {
  return (
    isRecord(value) &&
    isSegmentIndex(value.seq) &&
    isSegmentIndex(value.sizeBytes)
  );
}

export function isCloseRecordingRequest(
  value: unknown,
): value is CloseRecordingRequest {
  return (
    isRecord(value) &&
    isSegmentIndex(value.segments) &&
    value.segments <= EXTENSION_RECORDING_MAX_SEGMENTS &&
    isSegmentIndex(value.bytes) &&
    typeof value.interrupted === "boolean"
  );
}

export function isCloseRecordingResponse(
  value: unknown,
): value is CloseRecordingResponse {
  if (!isRecord(value)) {
    return false;
  }

  if (value.status === "complete") {
    return isSegmentIndex(value.segments) && isSegmentIndex(value.bytes);
  }

  return (
    value.status === "missing" &&
    Array.isArray(value.missing) &&
    value.missing.every(isSegmentIndex)
  );
}
