import { Ok, type Result } from "@/src/domain/result";

/** Tests that decode a recording look for this tone on the right channel. */
const FAKE_TAB_TONE_HZ = 880;

/**
 * A test sets `globalThis.holdCapture` in the worker to keep the capture
 * pending. `globalThis.streamRequests` counts the ids asked for, and
 * `globalThis.offscreenAtRequest` notes whether the offscreen document, which
 * consumes the single-use id, already existed.
 */
export async function requestStreamId(
  _tabId: number,
): Promise<Result<string, string>> {
  const requested = Number(Reflect.get(globalThis, "streamRequests") ?? 0);
  Reflect.set(globalThis, "streamRequests", requested + 1);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  Reflect.set(globalThis, "offscreenAtRequest", contexts.length > 0);
  await Reflect.get(globalThis, "holdCapture");
  return Ok("fake-stream-id");
}

/**
 * Stands in for a tab that plays a steady tone. A headless run cannot be
 * granted the activeTab invocation that real tab capture needs. A test sets
 * `globalThis.captureFailure` in the offscreen document to make opening the
 * stream fail with that message, as Chrome does for a blocked tab.
 */
export function openStream(_streamId: string): Promise<MediaStream> {
  const failure: unknown = Reflect.get(globalThis, "captureFailure");
  if (typeof failure === "string") {
    return Promise.reject(new Error(failure));
  }

  const context = new AudioContext();
  const tone = context.createOscillator();
  tone.frequency.value = FAKE_TAB_TONE_HZ;
  const level = context.createGain();
  level.gain.value = 0.5;
  const tab = context.createMediaStreamDestination();
  tone.connect(level).connect(tab);
  tone.start();
  return Promise.resolve(tab.stream);
}
