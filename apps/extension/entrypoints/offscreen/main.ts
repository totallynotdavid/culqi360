import { openStream } from "#tab-capture";
import { isOffscreenMessage, type RuntimeMessage } from "@/src/domain/messages";
import { mixChannels, type ChannelMix } from "@/src/services/channel-mix";
import { openMicrophone } from "@/src/services/microphone";
import {
  beginRecording,
  finishRecording,
  recordMicrophoneLost,
  storeChunk,
} from "@/src/services/recording-store";

const CHUNK_MS = 1000;
const MIME_TYPE = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
  ? "audio/webm;codecs=opus"
  : "audio/webm";

interface Capture {
  tab: MediaStream;
  mic: MediaStream;
  mix: ChannelMix;
  /**
   * Set before the tracks are stopped. Chrome does not fire `ended` for
   * `stop()` (measured), but an `ended` after release is the recorder letting
   * go, never a lost device, so the listeners must not rely on that.
   */
  released: boolean;
}

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
 * Open the tab stream before requesting the microphone. Its id is single use,
 * and an id that is never opened keeps the tab blocked ("Cannot capture a tab
 * with an active stream") for about a minute. Release the tab stream when the
 * microphone grant is missing so the id is not stranded.
 */
async function openCapture(streamId: string): Promise<Capture> {
  const tab = await openStream(streamId);
  let mic: MediaStream | null = null;
  try {
    mic = await openMicrophone();
    const mix = await mixChannels({ mic, tab });
    return { tab, mic, mix, released: false };
  } catch (error: unknown) {
    stopTracks(tab);
    if (mic) {
      stopTracks(mic);
    }
    throw error;
  }
}

async function releaseCapture(capture: Capture): Promise<void> {
  capture.released = true;
  stopTracks(capture.tab);
  stopTracks(capture.mic);
  await capture.mix
    .close()
    .catch((error: unknown) =>
      console.error("audio context was not closed", error),
    );
}

function interrupt(state: ActiveRecorder): void {
  state.stopRequested = false;
  if (state.recorder.state !== "inactive") {
    state.recorder.stop();
  }
}

/**
 * Store each chunk before notifying the worker. Sequence numbers are assigned
 * after a successful write, so stored numbers remain 0..n-1 without gaps.
 */
function wireRecorder(input: {
  recordingId: string;
  capture: Capture;
  state: ActiveRecorder;
  done: () => void;
}): void {
  const { recordingId, capture, state } = input;
  const { recorder } = state;
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
      interrupt(state);
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

  recorder.onerror = () => interrupt(state);

  // The mixed stream never ends by itself. Losing the tab must end the
  // recording as interrupted.
  for (const track of capture.tab.getAudioTracks()) {
    track.addEventListener("ended", () => {
      if (!capture.released) {
        interrupt(state);
      }
    });
  }

  // The microphone is the agent's side only. Its loss leaves a silent left
  // channel, but the tab recording remains useful.
  for (const track of capture.mic.getAudioTracks()) {
    track.addEventListener("ended", () => {
      if (capture.released) {
        return;
      }
      recordMicrophoneLost(recordingId).catch((error: unknown) =>
        console.error("microphone loss was not saved", error),
      );
    });
  }

  recorder.onstop = () => {
    writes
      .then(async () => {
        await releaseCapture(capture);
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

  const capture = await openCapture(streamId);
  let begunId: string | null = null;

  try {
    const recorder = new MediaRecorder(capture.mix.stream, {
      mimeType: MIME_TYPE,
    });
    const recording = await beginRecording(callId);
    begunId = recording.id;
    let done: () => void = () => undefined;
    const finished = new Promise<void>((resolve) => {
      done = resolve;
    });
    const state: ActiveRecorder = { recorder, finished, stopRequested: false };
    active = state;

    wireRecorder({ recordingId: recording.id, capture, state, done });
    recorder.start(CHUNK_MS);
  } catch (error: unknown) {
    active = null;
    await releaseCapture(capture);
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
