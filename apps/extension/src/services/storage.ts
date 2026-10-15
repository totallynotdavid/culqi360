import {
  createInitialState,
  STORAGE_KEY,
  type ExtensionState,
} from "@/src/domain/model";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isQueueJobType(
  value: unknown,
): value is ExtensionState["queue"][number]["type"] {
  return (
    value === "executive.presence" ||
    value === "executive.heartbeat" ||
    value === "call.lifecycle" ||
    value === "call.metric" ||
    value === "recording.chunk" ||
    value === "recording.completed"
  );
}

function normalizeState(value: unknown): ExtensionState {
  const initial = createInitialState();
  if (!isObject(value) || value.schemaVersion !== 1) {
    return initial;
  }

  const currentCall = isObject(value.currentCall) ? value.currentCall : null;
  const handoff = isObject(value.handoff) ? value.handoff : null;
  const recording = isObject(value.recording) ? value.recording : {};
  const syncConfig = isObject(value.syncConfig) ? value.syncConfig : {};
  const sync = isObject(value.sync) ? value.sync : {};

  const normalizedQueue = Array.isArray(value.queue)
    ? value.queue.filter(isObject).map((job) => ({
        id: typeof job.id === "string" ? job.id : crypto.randomUUID(),
        sequence: asNumber(job.sequence, 0),
        type: isQueueJobType(job.type) ? job.type : "call.metric",
        payload: isObject(job.payload) ? job.payload : {},
        createdAt: asNumber(job.createdAt, Date.now()),
        attemptCount: asNumber(job.attemptCount, 0),
        nextAttemptAt: asNumber(job.nextAttemptAt, Date.now()),
        lastError: asNullableString(job.lastError),
      }))
    : initial.queue;

  return {
    schemaVersion: 1,
    installationId:
      typeof value.installationId === "string" &&
      value.installationId.trim() !== ""
        ? value.installationId
        : initial.installationId,
    nextEventSequence: Math.max(1, asNumber(value.nextEventSequence, 1)),
    handoff: handoff
      ? {
          assignmentId: asString(handoff.assignmentId, ""),
          contactId: asString(handoff.contactId, ""),
          phone: typeof handoff.phone === "string" ? handoff.phone : "",
          clientName: asNullableString(handoff.clientName),
          organizationLabel: asNullableString(handoff.organizationLabel),
          receivedAt: asNumber(handoff.receivedAt, Date.now()),
        }
      : null,
    currentCall: currentCall
      ? {
          sessionId:
            typeof currentCall.sessionId === "string"
              ? currentCall.sessionId
              : crypto.randomUUID(),
          assignmentId: asString(currentCall.assignmentId, ""),
          contactId: asString(currentCall.contactId, ""),
          phone: typeof currentCall.phone === "string" ? currentCall.phone : "",
          startedAt: asNumber(currentCall.startedAt, Date.now()),
          connectedAt: asNullableNumber(currentCall.connectedAt),
          endedAt: asNullableNumber(currentCall.endedAt),
          phase:
            currentCall.phase === "dialing" ||
            currentCall.phase === "active" ||
            currentCall.phase === "ended"
              ? currentCall.phase
              : "dialing",
          outcome: asNullableString(currentCall.outcome),
          notes: asNullableString(currentCall.notes),
        }
      : null,
    previousCallEndedAt: asNullableNumber(value.previousCallEndedAt),
    recording: {
      phase:
        recording.phase === "idle" ||
        recording.phase === "starting" ||
        recording.phase === "recording" ||
        recording.phase === "stopping" ||
        recording.phase === "error"
          ? recording.phase
          : initial.recording.phase,
      streamId: asNullableString(recording.streamId),
      startedAt: asNullableNumber(recording.startedAt),
      stoppedAt: asNullableNumber(recording.stoppedAt),
      error: asNullableString(recording.error),
      chunkCount: asNumber(recording.chunkCount, 0),
    },
    queue: normalizedQueue,
    syncConfig: {
      apiBaseUrl: asNullableString(syncConfig.apiBaseUrl),
      sessionToken: asNullableString(syncConfig.sessionToken),
      refreshToken: asNullableString(syncConfig.refreshToken),
    },
    sync: {
      lastSyncAt: asNullableNumber(sync.lastSyncAt),
      lastSyncError: asNullableString(sync.lastSyncError),
    },
  };
}

export async function readState(): Promise<ExtensionState> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const normalized = normalizeState(stored[STORAGE_KEY] as unknown);
  await writeState(normalized);
  return normalized;
}

export async function writeState(state: ExtensionState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}
