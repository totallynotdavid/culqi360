import { openStream } from "#tab-capture";
import { isOffscreenMessage, type RuntimeMessage } from "@/src/domain/messages";
import {
  beginRecording,
  finishRecording,
  storeChunk,
} from "@/src/services/recording-store";

const CHUNK_MS = 1000;
const MIME_TYPE = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
  ? "audio/webm;codecs=opus"
  : "audio/webm";

interface ActiveRecorder {
  recorder: MediaRecorder;
  finished: Promise<void>;
  /** The close is interrupted when the stream ends without this request. */
  stopRequested: boolean;
}

type Reply = { ok: true } | { ok: false; error: string };

let active: ActiveRecorder | null = null;

function notifyWorker(message: RuntimeMessage): void {
  browser.runtime.sendMessage(message).catch(() => undefined);
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/**
 * Store each chunk before notifying the worker. Sequence numbers are assigned
 * after a successful write, so stored numbers remain 0..n-1 without gaps.
 */
function wireRecorder(input: {
  recorder: MediaRecorder;
  recordingId: string;
  stream: MediaStream;
  state: ActiveRecorder;
  done: () => void;
}): void {
  const { recorder, recordingId, state } = input;
  let nextSeq = 0;
  let chunkStartedAt = Date.now();
  let writes: Promise<void> = Promise.resolve();
  let writeFailed = false;

  async function storeNext(blob: Blob, startedAt: number): Promise<void> {
    if (writeFailed) {
      return;
    }
    const seq = nextSeq;
    try {
      await storeChunk({ recordingId, seq, blob, startedAt });
    } catch (error: unknown) {
      console.error(`chunk ${seq} was not saved`, error);
      writeFailed = true;
      state.stopRequested = false;
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
      return;
    }
    nextSeq += 1;
    notifyWorker({ type: "recording.chunk", recordingId, seq });
  }

  recorder.ondataavailable = (event) => {
    if (event.data.size === 0) {
      return;
    }
    const startedAt = chunkStartedAt;
    chunkStartedAt = Date.now();
    writes = writes.then(() => storeNext(event.data, startedAt));
  };

  recorder.onerror = () => {
    state.stopRequested = false;
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  recorder.onstop = () => {
    writes
      .then(() => {
        stopTracks(input.stream);
        return finishRecording(recordingId, !state.stopRequested);
      })
      .catch((error: unknown) => console.error("close was not queued", error))
      .finally(() => {
        active = null;
        // The stop request is answered first, then the worker may close this
        // document.
        input.done();
        notifyWorker({ type: "recording.finished", recordingId });
      });
  };
}

async function startRecorder(callId: string, streamId: string): Promise<void> {
  if (active) {
    throw new Error("the recorder is already running");
  }

  const stream = await openStream(streamId);
  let begunId: string | null = null;

  try {
    const recorder = new MediaRecorder(stream, { mimeType: MIME_TYPE });
    const recording = await beginRecording(callId);
    begunId = recording.id;
    let done: () => void = () => undefined;
    const finished = new Promise<void>((resolve) => {
      done = resolve;
    });
    const state: ActiveRecorder = { recorder, finished, stopRequested: false };
    active = state;

    wireRecorder({
      recorder,
      recordingId: recording.id,
      stream,
      state,
      done,
    });
    recorder.start(CHUNK_MS);
  } catch (error: unknown) {
    active = null;
    stopTracks(stream);
    if (begunId !== null) {
      // The create job may already be on its way, so the server recording needs
      // its close.
      await finishRecording(begunId, true).catch(() => undefined);
    }
    throw error;
  }
}

async function stopRecorder(): Promise<void> {
  const current = active;
  if (!current) {
    return;
  }
  current.stopRequested = true;
  if (current.recorder.state !== "inactive") {
    current.recorder.stop();
  }
  await current.finished;
}

function toReply(work: Promise<void>): Promise<Reply> {
  return work.then(
    (): Reply => ({ ok: true }),
    (error: unknown): Reply => ({
      ok: false,
      error: error instanceof Error ? error.message : "recorder failed",
    }),
  );
}

browser.runtime.onMessage.addListener((message: unknown) => {
  if (!isOffscreenMessage(message)) {
    return undefined;
  }

  switch (message.type) {
    case "offscreen.recording.start":
      return toReply(startRecorder(message.callId, message.streamId));
    case "offscreen.recording.stop":
      return toReply(stopRecorder());
    default:
      return message satisfies never;
  }
});
