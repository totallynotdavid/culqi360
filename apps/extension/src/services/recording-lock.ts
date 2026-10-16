import { read } from "./database";
import { finishRecording } from "./recording-store";

/**
 * A recorder holds this lock for as long as it records. Chrome releases a Web
 * Lock when its holder dies (a crashed or closed offscreen document, a
 * restarted browser), so a lock that can be taken means nobody records. It
 * replaces a heartbeat port, which the worker's idle shutdown would cut.
 */
function recordingLockName(callId: string): string {
  return `recording:${callId}`;
}

/**
 * Takes the lock of `callId` and keeps it until the returned function is
 * called. Returns null when another recorder already holds it.
 */
export function holdRecordingLock(
  callId: string,
): Promise<(() => void) | null> {
  return new Promise((resolve, reject) => {
    navigator.locks
      .request(recordingLockName(callId), { ifAvailable: true }, (lock) => {
        if (lock === null) {
          resolve(null);
          return undefined;
        }
        return new Promise<void>((release) => resolve(release));
      })
      .catch(reject);
  });
}

/**
 * Closes, as interrupted, every recording that claims to be running while its
 * lock is free. The recorder takes the lock before it writes the `recording`
 * row and stores `closing` before it releases it, so a free lock beside a
 * `recording` row is never a live recorder. No chunk closes as zero segments.
 */
export async function interruptOrphanedRecordings(): Promise<number> {
  const recordings = await read((tx) => tx.getAll("recordings"));
  const running = recordings.filter(
    (recording) => recording.status === "recording",
  );

  let interrupted = 0;
  for (const recording of running) {
    // oxlint-disable-next-line no-await-in-loop -- one recording at a time keeps the lock order simple
    await navigator.locks.request(
      recordingLockName(recording.callId),
      { ifAvailable: true },
      async (lock) => {
        if (lock === null) {
          return;
        }
        await finishRecording(recording.id, true);
        interrupted += 1;
      },
    );
  }
  return interrupted;
}
