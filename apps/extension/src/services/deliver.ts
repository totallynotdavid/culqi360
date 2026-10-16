import {
  EXTENSION_EVENTS_PATH,
  EXTENSION_RECORDINGS_PATH,
  EXTENSION_SEGMENT_CHANNELS_HEADER,
  EXTENSION_SEGMENT_STARTED_AT_HEADER,
  isCloseRecordingResponse,
  isCreateRecordingResponse,
  isUploadSegmentResponse,
  recordingClosePath,
  recordingSegmentPath,
  type CloseRecordingRequest,
} from "@crm/contracts/extension";

import type { ChunkRow, QueueRow, SessionRecord } from "@/src/domain/model";

import { callApi, type Reply } from "./api";
import { backoffMs } from "./backoff";
import { chunkRange, commit, read } from "./database";

/**
 * What one delivery attempt did to its job. `done` means the row is already
 * removed and `waiting` counts no attempt. `retry` and `unauthorized` are `Reply`.
 */
export type Outcome =
  | { kind: "done" }
  | { kind: "waiting" }
  | Exclude<Reply, { kind: "ok" }>;

const DONE: Outcome = { kind: "done" };
const WAITING: Outcome = { kind: "waiting" };
const MAX_LISTED_SEGMENTS = 10;

function dropRow(sequence: number): Promise<void> {
  return commit((tx) => tx.delete("queue", sequence));
}

async function finish(sequence: number): Promise<Outcome> {
  await dropRow(sequence);
  return DONE;
}

function jsonBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function invalidAnswer(path: string): Outcome {
  return { kind: "retry", error: `${path} answered with an unexpected body` };
}

function listSegments(seqs: number[]): string {
  const shown = seqs.slice(0, MAX_LISTED_SEGMENTS).join(", ");
  return seqs.length > MAX_LISTED_SEGMENTS ? `${shown}, ...` : shown;
}

async function deliverEvent(
  row: QueueRow,
  job: Extract<QueueRow["job"], { kind: "event" }>,
  session: SessionRecord,
): Promise<Outcome> {
  const reply = await callApi(session, EXTENSION_EVENTS_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: job.id,
      sequence: row.sequence,
      type: job.type,
      payload: job.payload,
      createdAt: row.createdAt,
    }),
  });
  return reply.kind === "ok" ? finish(row.sequence) : reply;
}

async function deliverCreate(
  row: QueueRow,
  recordingId: string,
  session: SessionRecord,
): Promise<Outcome> {
  const recording = await read((tx) => tx.get("recordings", recordingId));
  if (!recording || recording.remoteId !== null) {
    return finish(row.sequence);
  }

  const reply = await callApi(session, EXTENSION_RECORDINGS_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ callId: recording.callId }),
  });
  if (reply.kind !== "ok") {
    return reply;
  }
  const body = await jsonBody(reply.response);
  if (!isCreateRecordingResponse(body)) {
    return invalidAnswer(EXTENSION_RECORDINGS_PATH);
  }

  // The offscreen document may have closed the recording while the request was
  // in flight, so the row is read again here and only `remoteId` changes.
  await commit(async (tx) => {
    const current = await tx.get("recordings", recordingId);
    if (current) {
      await tx.put("recordings", { ...current, remoteId: body.recordingId });
    }
    await tx.delete("queue", row.sequence);
  });
  return DONE;
}

async function deliverSegment(
  row: QueueRow,
  job: { recordingId: string; seq: number },
  session: SessionRecord,
): Promise<Outcome> {
  const { recording, chunk } = await read(async (tx) => ({
    recording: await tx.get("recordings", job.recordingId),
    chunk: await tx.get("chunks", [job.recordingId, job.seq]),
  }));
  if (!chunk) {
    return finish(row.sequence);
  }
  if (!recording?.remoteId) {
    return WAITING;
  }

  const path = recordingSegmentPath(recording.remoteId, job.seq);
  const reply = await callApi(session, path, {
    method: "PUT",
    headers: {
      "content-type": chunk.blob.type || "audio/webm",
      [EXTENSION_SEGMENT_CHANNELS_HEADER]: chunk.channels,
      [EXTENSION_SEGMENT_STARTED_AT_HEADER]: String(chunk.startedAt),
    },
    body: chunk.blob,
  });
  if (reply.kind !== "ok") {
    return reply;
  }
  const body = await jsonBody(reply.response);
  if (!isUploadSegmentResponse(body)) {
    return invalidAnswer(path);
  }

  // A 2xx is not proof of storage: the audio stays until the close answers
  // `complete`.
  return finish(row.sequence);
}

/**
 * Queues the segments the server lacks, or reports one that is gone. The
 * segments wait as long as the close does, so a server that keeps answering
 * `missing` costs one round per backoff and cannot spin.
 */
async function requeueMissing(
  row: QueueRow,
  recordingId: string,
  missing: number[],
): Promise<Outcome> {
  const dueAt = Date.now() + backoffMs(row.attempts + 1);
  return commit(async (tx) => {
    const chunks = await tx.getAll("chunks", chunkRange(recordingId));
    const stored = new Set(chunks.map((chunk) => chunk.seq));
    const gone = missing.filter((seq) => !stored.has(seq));
    if (gone.length > 0) {
      return {
        kind: "retry",
        error: `server is missing segments ${listSegments(gone)} that are no longer on this device`,
      };
    }

    for (const seq of missing) {
      // oxlint-disable-next-line no-await-in-loop -- requests of one transaction run in order
      await tx.enqueue({ kind: "recording.segment", recordingId, seq }, dueAt);
    }
    return {
      kind: "retry",
      error: `server is missing segments ${listSegments(missing)}, sending them again`,
    };
  });
}

function totalsOf(chunks: ChunkRow[]): { segments: number; bytes: number } {
  return {
    segments: (chunks.at(-1)?.seq ?? -1) + 1,
    bytes: chunks.reduce((total, chunk) => total + chunk.bytes, 0),
  };
}

/**
 * Deletes the audio only if it is still exactly what the server confirmed, so
 * a chunk written after the manifest was built is never deleted unsent.
 */
async function completeRecording(
  row: QueueRow,
  recordingId: string,
  confirmed: { segments: number; bytes: number },
): Promise<Outcome> {
  return commit(async (tx) => {
    const chunks = await tx.getAll("chunks", chunkRange(recordingId));
    const stored = totalsOf(chunks);
    if (
      stored.segments !== confirmed.segments ||
      stored.bytes !== confirmed.bytes
    ) {
      return {
        kind: "retry",
        error: `local audio changed after the close was sent: ${stored.segments} segments (${stored.bytes} bytes), the server confirmed ${confirmed.segments} (${confirmed.bytes})`,
      };
    }

    await tx.delete("chunks", chunkRange(recordingId));
    const recording = await tx.get("recordings", recordingId);
    if (recording) {
      await tx.put("recordings", { ...recording, status: "complete" });
    }
    await tx.delete("queue", row.sequence);
    return DONE;
  });
}

async function deliverClose(
  row: QueueRow,
  job: { recordingId: string; interrupted: boolean },
  session: SessionRecord,
): Promise<Outcome> {
  const snapshot = await read(async (tx) => ({
    recording: await tx.get("recordings", job.recordingId),
    chunks: await tx.getAll("chunks", chunkRange(job.recordingId)),
    queue: await tx.getAll("queue"),
  }));
  const { recording, chunks } = snapshot;
  if (!recording || recording.status === "complete") {
    return finish(row.sequence);
  }

  // Closing before every segment is sent would report audio as missing that is
  // only waiting in the queue.
  const segmentsLeft = snapshot.queue.some(
    (other) =>
      other.job.kind === "recording.segment" &&
      other.job.recordingId === job.recordingId,
  );
  if (!recording.remoteId || segmentsLeft) {
    return WAITING;
  }

  const manifest: CloseRecordingRequest = {
    ...totalsOf(chunks),
    interrupted: job.interrupted,
  };
  const path = recordingClosePath(recording.remoteId);
  const reply = await callApi(session, path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(manifest),
  });
  if (reply.kind !== "ok") {
    return reply;
  }
  const answer = await jsonBody(reply.response);
  if (!isCloseRecordingResponse(answer)) {
    return invalidAnswer(path);
  }

  if (answer.status === "missing") {
    return requeueMissing(row, job.recordingId, answer.missing);
  }
  if (
    answer.segments !== manifest.segments ||
    answer.bytes !== manifest.bytes
  ) {
    return {
      kind: "retry",
      error: `server completed ${answer.segments} segments (${answer.bytes} bytes), expected ${manifest.segments} (${manifest.bytes})`,
    };
  }
  return completeRecording(row, job.recordingId, manifest);
}

/** Sends one queue row. Never throws for a server or network failure. */
export function deliver(
  row: QueueRow,
  session: SessionRecord,
): Promise<Outcome> {
  const { job } = row;
  switch (job.kind) {
    case "event":
      return deliverEvent(row, job, session);
    case "recording.create":
      return deliverCreate(row, job.recordingId, session);
    case "recording.segment":
      return deliverSegment(row, job, session);
    case "recording.close":
      return deliverClose(row, job, session);
    default:
      return job satisfies never;
  }
}
