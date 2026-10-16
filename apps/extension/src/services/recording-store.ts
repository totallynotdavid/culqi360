import { EXTENSION_SEGMENT_CHANNEL_LAYOUT } from "@crm/contracts/extension";

import type { RecordingRow } from "@/src/domain/model";
import { isLiveCall } from "@/src/domain/model";

import { commit, type Transaction } from "./database";
import { enqueueCallMetric } from "./events";

/**
 * Why this call cannot start a recording, or null when it can. A recording
 * needs its call to be dialing or active, and the server accepts one per call.
 */
export async function recordingBlocker(
  tx: Transaction,
  callId: string,
): Promise<string | null> {
  const call = await tx.get("calls", callId);
  if (!isLiveCall(call ?? null)) {
    return "there is no live call to record";
  }
  const recordings = await tx.getAll("recordings");
  if (recordings.some((recording) => recording.callId === callId)) {
    return "this call already has a recording, and the server accepts one per call";
  }
  return null;
}

/**
 * Writes the recording row and the job that creates it on the server. The
 * check runs in this transaction because the caller awaited a capture stream
 * since it last looked, and the call may have ended meanwhile.
 */
export async function beginRecording(callId: string): Promise<RecordingRow> {
  return commit(async (tx) => {
    const blocker = await recordingBlocker(tx, callId);
    if (blocker !== null) {
      throw new Error(blocker);
    }

    const recording: RecordingRow = {
      id: crypto.randomUUID(),
      callId,
      remoteId: null,
      startedAt: Date.now(),
      status: "recording",
      interrupted: false,
      microphoneLostAt: null,
    };
    await tx.put("recordings", recording);
    await tx.enqueue({ kind: "recording.create", recordingId: recording.id });
    return recording;
  });
}

/**
 * Marks the recording as tab-only and queues its metric in one transaction.
 * Repeated notifications leave an already marked recording unchanged.
 */
export function recordMicrophoneLost(recordingId: string): Promise<void> {
  return commit(async (tx) => {
    const recording = await tx.get("recordings", recordingId);
    if (
      recording?.status !== "recording" ||
      recording.microphoneLostAt != null
    ) {
      return;
    }

    const lostAt = Date.now();
    await tx.put("recordings", { ...recording, microphoneLostAt: lostAt });
    await enqueueCallMetric(tx, {
      event: "microphone_lost",
      sessionId: recording.callId,
      at: lostAt,
    });
  });
}

/** Stores one chunk and the job that uploads it in the same transaction. */
export function storeChunk(input: {
  recordingId: string;
  seq: number;
  blob: Blob;
  startedAt: number;
}): Promise<void> {
  return commit(async (tx) => {
    await tx.put("chunks", {
      recordingId: input.recordingId,
      seq: input.seq,
      blob: input.blob,
      bytes: input.blob.size,
      startedAt: input.startedAt,
      channels: EXTENSION_SEGMENT_CHANNEL_LAYOUT,
    });
    await tx.enqueue({
      kind: "recording.segment",
      recordingId: input.recordingId,
      seq: input.seq,
    });
  });
}

/**
 * Ends a recording that is still `recording` and queues its close. A recording
 * with no audio closes too, as zero segments: its create job may already have
 * reached the server, which would otherwise keep the recording open until its
 * sweep.
 */
export function finishRecording(
  recordingId: string,
  interrupted: boolean,
): Promise<void> {
  return commit(async (tx) => {
    const recording = await tx.get("recordings", recordingId);
    if (recording?.status !== "recording") {
      return;
    }

    await tx.put("recordings", {
      ...recording,
      status: "closing",
      interrupted,
    });
    await tx.enqueue({ kind: "recording.close", recordingId, interrupted });
  });
}
