import type {
  ExecutivePresenceStatus,
  ExecutiveStateSnapshot,
  SyncHealth,
} from "@crm/contracts/extension";

export const STORAGE_KEY = "crm_extension_state_v1" as const;

export type CallPhase = "dialing" | "active" | "ended";

export type RecordingPhase =
  | "idle"
  | "starting"
  | "recording"
  | "stopping"
  | "error";

export type QueueJobType =
  | "executive.presence"
  | "executive.heartbeat"
  | "call.lifecycle"
  | "call.metric"
  | "recording.chunk"
  | "recording.completed";

export interface CallSession {
  sessionId: string;
  assignmentId: string;
  contactId: string;
  phone: string;
  startedAt: number;
  connectedAt: number | null;
  endedAt: number | null;
  phase: CallPhase;
  outcome: string | null;
  notes: string | null;
}

export interface AssignmentHandoff {
  assignmentId: string;
  contactId: string;
  phone: string;
  clientName: string | null;
  organizationLabel: string | null;
  receivedAt: number;
}

export interface RecordingState {
  phase: RecordingPhase;
  streamId: string | null;
  startedAt: number | null;
  stoppedAt: number | null;
  error: string | null;
  chunkCount: number;
}

export interface QueueJob {
  id: string;
  sequence: number;
  type: QueueJobType;
  payload: Record<string, unknown>;
  createdAt: number;
  attemptCount: number;
  nextAttemptAt: number;
  lastError: string | null;
}

export interface SyncConfig {
  apiBaseUrl: string | null;
  sessionToken: string | null;
  refreshToken: string | null;
}

export interface ExtensionState {
  schemaVersion: 1;
  installationId: string;
  nextEventSequence: number;
  handoff: AssignmentHandoff | null;
  currentCall: CallSession | null;
  previousCallEndedAt: number | null;
  recording: RecordingState;
  queue: QueueJob[];
  syncConfig: SyncConfig;
  sync: {
    lastSyncAt: number | null;
    lastSyncError: string | null;
  };
}

export function createInitialState(): ExtensionState {
  return {
    schemaVersion: 1,
    installationId: crypto.randomUUID(),
    nextEventSequence: 1,
    handoff: null,
    currentCall: null,
    previousCallEndedAt: null,
    recording: {
      phase: "idle",
      streamId: null,
      startedAt: null,
      stoppedAt: null,
      error: null,
      chunkCount: 0,
    },
    queue: [],
    syncConfig: {
      apiBaseUrl: null,
      sessionToken: null,
      refreshToken: null,
    },
    sync: {
      lastSyncAt: null,
      lastSyncError: null,
    },
  };
}

function getPresenceStatus(state: ExtensionState): ExecutivePresenceStatus {
  const activeCall = state.currentCall;
  if (activeCall?.phase === "dialing") {
    return "dialing";
  }

  if (activeCall?.phase === "active") {
    return "active";
  }

  if (activeCall?.phase === "ended") {
    return "wrap_up";
  }

  if (state.handoff) {
    return "ready";
  }

  return "idle";
}

function getPresenceUpdatedAt(state: ExtensionState): number | null {
  const activeCall = state.currentCall;
  if (activeCall?.phase === "dialing") {
    return activeCall.startedAt;
  }

  if (activeCall?.phase === "active") {
    return activeCall.connectedAt ?? activeCall.startedAt;
  }

  if (activeCall?.phase === "ended") {
    return activeCall.endedAt ?? activeCall.startedAt;
  }

  if (state.handoff) {
    return state.handoff.receivedAt;
  }

  return null;
}

function getSyncHealth(state: ExtensionState): SyncHealth {
  const hasQueuedBusinessWork = state.queue.some(
    (job) => job.type !== "executive.heartbeat",
  );

  if (
    state.queue.length > 0 &&
    state.syncConfig.sessionToken === null &&
    state.syncConfig.refreshToken === null
  ) {
    return "reauth_required";
  }

  if (state.queue.length > 0 && state.sync.lastSyncError) {
    return "error";
  }

  if (hasQueuedBusinessWork) {
    return "pending";
  }

  return "ok";
}

export function getExecutiveState(
  state: ExtensionState,
): ExecutiveStateSnapshot {
  const activeCall = state.currentCall;
  return {
    presenceStatus: getPresenceStatus(state),
    syncHealth: getSyncHealth(state),
    assignmentId:
      state.handoff?.assignmentId ?? activeCall?.assignmentId ?? null,
    contactId: state.handoff?.contactId ?? activeCall?.contactId ?? null,
    phone: state.handoff?.phone ?? activeCall?.phone ?? null,
    presenceUpdatedAt: getPresenceUpdatedAt(state),
    syncUpdatedAt: state.sync.lastSyncAt,
  };
}
