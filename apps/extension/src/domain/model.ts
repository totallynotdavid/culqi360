import type {
  ExecutivePresenceStatus,
  ExecutiveStateSnapshot,
  SyncHealth,
} from "@crm/contracts/extension";

export type CallPhase = "ready" | "dialing" | "active" | "ended";

/** Key is the server-minted `callId`. The newest `receivedAt` is current. */
export interface CallRow {
  id: string;
  assignmentId: string;
  contactId: string;
  phone: string;
  clientName: string | null;
  organizationLabel: string | null;
  receivedAt: number;
  startedAt: number | null;
  connectedAt: number | null;
  endedAt: number | null;
  phase: CallPhase;
  outcome: string | null;
  notes: string | null;
}

export type RecordingStatus = "recording" | "closing" | "complete";

/**
 * `id` is local so recording works offline. `remoteId` is the server's
 * `recordingId`, filled in when the create job succeeds.
 */
export interface RecordingRow {
  id: string;
  callId: string;
  remoteId: string | null;
  startedAt: number;
  status: RecordingStatus;
  interrupted: boolean;
}

export interface ChunkRow {
  recordingId: string;
  seq: number;
  blob: Blob;
  bytes: number;
  startedAt: number;
  channels: string;
}

export type QueueJob =
  | {
      kind: "event";
      id: string;
      type: string;
      payload: Record<string, unknown>;
    }
  | { kind: "recording.create"; recordingId: string }
  | { kind: "recording.segment"; recordingId: string; seq: number }
  | { kind: "recording.close"; recordingId: string; interrupted: boolean };

export interface QueueRow {
  sequence: number;
  job: QueueJob;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
}

export interface SessionRecord {
  installationId: string;
  origin: string;
  sessionToken: string | null;
  refreshToken: string | null;
}

export type RecordingPhase = "idle" | RecordingStatus;

export interface ExtensionState {
  call: CallRow | null;
  recording: {
    phase: RecordingPhase;
    chunkCount: number;
  };
  queue: {
    pending: number;
  };
  sync: {
    signedIn: boolean;
    lastSyncAt: number | null;
    lastSyncError: string | null;
  };
}

export function isLiveCall(call: CallRow | null): call is CallRow {
  return call?.phase === "dialing" || call?.phase === "active";
}

function presenceStatus(call: CallRow | null): ExecutivePresenceStatus {
  if (!call) return "idle";

  switch (call.phase) {
    case "ready":
      return "ready";
    case "dialing":
      return "dialing";
    case "active":
      return "active";
    case "ended":
      return "wrap_up";
    default:
      return call.phase satisfies never;
  }
}

function presenceUpdatedAt(call: CallRow | null): number | null {
  if (!call) return null;

  switch (call.phase) {
    case "ready":
      return call.receivedAt;
    case "dialing":
      return call.startedAt;
    case "active":
      return call.connectedAt ?? call.startedAt;
    case "ended":
      return call.endedAt ?? call.startedAt;
    default:
      return call.phase satisfies never;
  }
}

function syncHealth(state: ExtensionState): SyncHealth {
  if (state.queue.pending > 0 && !state.sync.signedIn) {
    return "reauth_required";
  }
  if (state.queue.pending > 0 && state.sync.lastSyncError) {
    return "error";
  }
  return state.queue.pending > 0 ? "pending" : "ok";
}

export function getExecutiveState(
  state: ExtensionState,
): ExecutiveStateSnapshot {
  const call = state.call;
  return {
    presenceStatus: presenceStatus(call),
    syncHealth: syncHealth(state),
    assignmentId: call?.assignmentId ?? null,
    contactId: call?.contactId ?? null,
    phone: call?.phone ?? null,
    presenceUpdatedAt: presenceUpdatedAt(call),
    syncUpdatedAt: state.sync.lastSyncAt,
  };
}
