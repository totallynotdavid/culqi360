import { requestStreamId } from "#tab-capture";
import type { OffscreenMessage } from "@/src/domain/messages";
import { Err, Ok, type Result } from "@/src/domain/result";
import { commit, read } from "@/src/services/database";
import {
  closeOffscreenDocument,
  ensureOffscreenDocument,
} from "@/src/services/offscreen";
import { recordingBlocker } from "@/src/services/recording-store";

import { latestCall } from "./calls";

/**
 * Refuses before the capture stream is requested. `beginRecording` checks again
 * in its own transaction, since the call can end while the stream is set up.
 */
async function recordableCallId(): Promise<Result<string, string>> {
  return read(async (tx) => {
    const call = await latestCall(tx);
    if (!call) {
      return Err("there is no live call to record");
    }
    const blocker = await recordingBlocker(tx, call.id);
    return blocker === null ? Ok(call.id) : Err(blocker);
  });
}

function isOffscreenReply(
  value: unknown,
): value is { ok: boolean; error?: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "ok") === "boolean"
  );
}

async function sendToOffscreen(
  message: OffscreenMessage,
): Promise<Result<void, string>> {
  const reply: unknown = await chrome.runtime.sendMessage(message);
  if (!isOffscreenReply(reply)) {
    return Err("the recorder did not answer");
  }
  return reply.ok ? Ok(undefined) : Err(reply.error ?? "the recorder failed");
}

async function openCapture(
  tabId: number,
  callId: string,
): Promise<Result<void, string>> {
  await ensureOffscreenDocument();

  const streamId = await requestStreamId(tabId);
  if (!streamId.ok) {
    return streamId;
  }

  return sendToOffscreen({
    type: "offscreen.recording.start",
    callId,
    streamId: streamId.value,
  });
}

/**
 * One request makes one attempt. A failed stream id leaves the tab blocked for
 * about a minute ("Cannot capture a tab with an active stream"), so retries
 * would fail too. Store the reason for the dashboard because the shortcut has
 * no caller to answer.
 */
export async function startRecording(
  tabId: number,
): Promise<Result<void, string>> {
  const callId = await recordableCallId();
  if (!callId.ok) {
    return callId;
  }

  const started = await openCapture(tabId, callId.value).catch(
    (error: unknown) =>
      Err(error instanceof Error ? error.message : "tab capture failed"),
  );
  await commit((tx) =>
    tx.setMeta("captureError", started.ok ? null : started.error),
  );
  if (!started.ok) {
    await closeOffscreenDocument();
  }
  return started;
}

async function hasOffscreenDocument(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  return contexts.length > 0;
}

/** Stops the recorder and queues a non-interrupted close. */
export async function stopRecording(): Promise<Result<void, string>> {
  if (!(await hasOffscreenDocument())) {
    return Ok(undefined);
  }
  return sendToOffscreen({ type: "offscreen.recording.stop" });
}
