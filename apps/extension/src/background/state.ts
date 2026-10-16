import type { RuntimeResponse } from "@/src/domain/messages";
import { getExecutiveState, type ExtensionState } from "@/src/domain/model";
import { chunkRange, read } from "@/src/services/database";
import { readSession } from "@/src/services/session";

import { latestCall } from "./calls";

export async function readState(): Promise<ExtensionState> {
  const session = await readSession();

  return read(async (tx) => {
    const call = await latestCall(tx);
    const recordings = await tx.getAll("recordings");
    const recording = call
      ? recordings.find((row) => row.callId === call.id)
      : undefined;
    const chunkCount = recording
      ? await tx.count("chunks", chunkRange(recording.id))
      : 0;
    const queue = await tx.getAll("queue");

    return {
      call,
      recording: { phase: recording?.status ?? "idle", chunkCount },
      queue: {
        pending: queue.filter(
          (row) =>
            !(
              row.job.kind === "event" && row.job.type === "executive.heartbeat"
            ),
        ).length,
      },
      sync: {
        signedIn: session?.sessionToken != null,
        lastSyncAt: (await tx.getMeta("lastSyncAt")) ?? null,
        lastSyncError: (await tx.getMeta("lastSyncError")) ?? null,
      },
    };
  });
}

export async function stateResponse(): Promise<RuntimeResponse> {
  const state = await readState();
  return { ok: true, state, executiveState: getExecutiveState(state) };
}

export async function errorResponse(error: string): Promise<RuntimeResponse> {
  const state = await readState();
  return {
    ok: false,
    error,
    state,
    executiveState: getExecutiveState(state),
  };
}
