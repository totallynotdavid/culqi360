import { Ok, type Result } from "@/src/domain/result";

/** Tests that decode a recording look for this tone on the right channel. */
const FAKE_TAB_TONE_HZ = 880;

/**
 * A test sets `globalThis.holdCapture` in the worker to keep the capture
 * pending, so it can change state while a recording is still starting.
 */
export async function requestStreamId(
  _tabId: number,
): Promise<Result<string, string>> {
  await Reflect.get(globalThis, "holdCapture");
  return Ok("fake-stream-id");
}

/**
 * Stands in for a tab that plays a steady tone. A headless run cannot be
 * granted the activeTab invocation that real tab capture needs.
 */
export function openStream(_streamId: string): Promise<MediaStream> {
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
