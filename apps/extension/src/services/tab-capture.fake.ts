import { Ok, type Result } from "@/src/domain/result";

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

export function openStream(_streamId: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
}
