import type { QueueRow } from "@/src/domain/model";

import { commit } from "./database";
import { readSession, writeSession } from "./session";

const STATE_KEY_V1 = "crm_extension_state_v1";
const JOURNAL_DATABASE_V1 = "crm_extension_journal_v1";
const API_SUFFIX = "/api";

interface LegacyJob {
  id: string;
  sequence: number;
  type: string;
  payload: Record<string, unknown>;
  createdAt: number;
  attemptCount: number;
  nextAttemptAt: number;
  lastError: string | null;
}

interface LegacyState {
  installationId: string;
  nextEventSequence: number;
  queue: LegacyJob[];
  origin: string | null;
  sessionToken: string | null;
  refreshToken: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJob(value: unknown): LegacyJob | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.sequence !== "number" ||
    typeof value.type !== "string" ||
    !isRecord(value.payload) ||
    typeof value.createdAt !== "number"
  ) {
    return null;
  }
  return {
    id: value.id,
    sequence: value.sequence,
    type: value.type,
    payload: value.payload,
    createdAt: value.createdAt,
    attemptCount:
      typeof value.attemptCount === "number" ? value.attemptCount : 0,
    nextAttemptAt:
      typeof value.nextAttemptAt === "number"
        ? value.nextAttemptAt
        : value.createdAt,
    lastError: typeof value.lastError === "string" ? value.lastError : null,
  };
}

function originOf(apiBaseUrl: unknown): string | null {
  if (typeof apiBaseUrl !== "string" || apiBaseUrl === "") {
    return null;
  }
  return apiBaseUrl.endsWith(API_SUFFIX)
    ? apiBaseUrl.slice(0, -API_SUFFIX.length)
    : apiBaseUrl;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function parseLegacyState(value: unknown): LegacyState | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.installationId !== "string"
  ) {
    return null;
  }

  const config = isRecord(value.syncConfig) ? value.syncConfig : {};
  const queue = Array.isArray(value.queue) ? value.queue : [];
  return {
    installationId: value.installationId,
    nextEventSequence:
      typeof value.nextEventSequence === "number" ? value.nextEventSequence : 1,
    queue: queue.flatMap((job) => {
      const parsed = parseJob(job);
      return parsed ? [parsed] : [];
    }),
    origin: originOf(config.apiBaseUrl),
    sessionToken: stringOrNull(config.sessionToken),
    refreshToken: stringOrNull(config.refreshToken),
  };
}

function awaitRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("indexeddb request failed"));
  });
}

/** v1 parked chunk audio in a separate database, keyed by job id. */
async function readJournalPayloads(): Promise<
  Map<string, Record<string, unknown>>
> {
  const open = indexedDB.open(JOURNAL_DATABASE_V1, 1);
  open.onupgradeneeded = () =>
    open.result.createObjectStore("payloads", { keyPath: "jobId" });
  const database = await awaitRequest(open);

  try {
    const records: unknown[] = await awaitRequest(
      database.transaction("payloads").objectStore("payloads").getAll(),
    );
    const payloads = new Map<string, Record<string, unknown>>();
    for (const record of records) {
      if (
        isRecord(record) &&
        typeof record.jobId === "string" &&
        isRecord(record.payload)
      ) {
        payloads.set(record.jobId, record.payload);
      }
    }
    return payloads;
  } finally {
    database.close();
  }
}

function deleteJournal(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(JOURNAL_DATABASE_V1);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error("failed to delete the v1 journal"));
  });
}

/**
 * A chunk job whose audio sat in the journal is sent as a plain event again.
 * One whose payload is gone has nothing left to send and is dropped.
 */
function toQueueRow(
  job: LegacyJob,
  journal: Map<string, Record<string, unknown>>,
): QueueRow | null {
  const payload =
    job.type === "recording.chunk" && job.payload.payloadStorage === "indexeddb"
      ? journal.get(job.id)
      : job.payload;
  if (payload === undefined) {
    return null;
  }

  return {
    sequence: job.sequence,
    job: { kind: "event", id: job.id, type: job.type, payload },
    createdAt: job.createdAt,
    attempts: job.attemptCount,
    nextAttemptAt: job.nextAttemptAt,
    lastError: job.lastError,
  };
}

function importQueue(legacy: LegacyState, rows: QueueRow[]): Promise<void> {
  return commit(async (tx) => {
    if (await tx.getMeta("importedV1")) {
      return;
    }

    await Promise.all(rows.map((row) => tx.put("queue", row)));
    const next = Math.max(
      legacy.nextEventSequence,
      ...rows.map((row) => row.sequence + 1),
    );
    await tx.setMeta(
      "nextSequence",
      Math.max(next, (await tx.getMeta("nextSequence")) ?? 1),
    );
    await tx.setMeta("importedV1", true);
  });
}

async function importSession(legacy: LegacyState): Promise<void> {
  if (legacy.origin === null || (await readSession()) !== null) {
    return;
  }
  await writeSession({
    installationId: legacy.installationId,
    origin: legacy.origin,
    sessionToken: legacy.sessionToken,
    refreshToken: legacy.refreshToken,
  });
}

/**
 * Moves a v1 install (queue, session and journal) into the IndexedDB store, then
 * removes the v1 data. The call and handoff in progress are dropped: they carry
 * no server-minted call id, so the server cannot accept events for them.
 * Safe to run again after a crash at any step.
 */
export async function migrateV1(): Promise<void> {
  const stored = await browser.storage.local.get(STATE_KEY_V1);
  if (!(STATE_KEY_V1 in stored)) {
    return;
  }

  const legacy = parseLegacyState(stored[STATE_KEY_V1]);
  if (legacy) {
    const journal = await readJournalPayloads();
    const rows = legacy.queue.flatMap((job) => {
      const row = toQueueRow(job, journal);
      return row ? [row] : [];
    });
    await importQueue(legacy, rows);
    await importSession(legacy);
  }

  await browser.storage.local.remove(STATE_KEY_V1);
  await deleteJournal();
}
