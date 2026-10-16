import { Err, Ok, type Result } from "@/src/domain/result";

/**
 * Asks Chrome for a stream id that the offscreen document can open. The id is
 * single use, so open it right away.
 */
export async function requestStreamId(
  tabId: number,
): Promise<Result<string, string>> {
  try {
    return Ok(await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }));
  } catch (error: unknown) {
    return Err(error instanceof Error ? error.message : "tab capture failed");
  }
}

type TabAudioConstraints = MediaTrackConstraints & {
  mandatory: { chromeMediaSource: "tab"; chromeMediaSourceId: string };
};

export function openStream(streamId: string): Promise<MediaStream> {
  const audio: TabAudioConstraints = {
    mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId },
  };
  return navigator.mediaDevices.getUserMedia({ audio, video: false });
}
