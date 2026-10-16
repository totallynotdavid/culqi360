import type { BridgeResponse } from "@crm/contracts/extension";
export type { ExternalRuntimeMessage } from "@crm/contracts/extension";
export { isExternalRuntimeMessage } from "@crm/contracts/extension";
import { isBridgeResponse } from "@crm/contracts/extension";

import type { ExtensionState } from "./model";

export type RuntimeMessage =
  | { type: "state.get" }
  | { type: "call.start" }
  | { type: "call.connected" }
  | { type: "call.end"; outcome?: string; notes?: string }
  | { type: "recording.start"; tabId: number }
  | { type: "recording.stop" }
  /** From the offscreen document: the chunk is already stored under this key. */
  | { type: "recording.chunk"; recordingId: string; seq: number }
  | { type: "recording.finished"; recordingId: string }
  | { type: "sync.flush" };

export type OffscreenMessage =
  | { type: "offscreen.recording.start"; callId: string; streamId: string }
  | { type: "offscreen.recording.stop" };

export type RuntimeResponse =
  | (Extract<BridgeResponse, { ok: true }> & {
      state: ExtensionState;
    })
  | (Extract<BridgeResponse, { ok: false }> & {
      state?: ExtensionState;
    });

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (!isObject(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "state.get":
    case "call.start":
    case "call.connected":
    case "recording.stop":
    case "sync.flush":
      return true;
    case "call.end":
      return isOptionalString(value.outcome) && isOptionalString(value.notes);
    case "recording.start":
      return typeof value.tabId === "number";
    case "recording.chunk":
      return (
        typeof value.recordingId === "string" && typeof value.seq === "number"
      );
    case "recording.finished":
      return typeof value.recordingId === "string";
    default:
      return false;
  }
}

export function isOffscreenMessage(value: unknown): value is OffscreenMessage {
  if (!isObject(value)) {
    return false;
  }

  switch (value.type) {
    case "offscreen.recording.stop":
      return true;
    case "offscreen.recording.start":
      return (
        typeof value.callId === "string" && typeof value.streamId === "string"
      );
    default:
      return false;
  }
}

function isExtensionState(value: unknown): value is ExtensionState {
  return (
    isObject(value) &&
    isObject(value.recording) &&
    isObject(value.queue) &&
    isObject(value.sync)
  );
}

export function isRuntimeResponse(value: unknown): value is RuntimeResponse {
  if (!isObject(value) || !isBridgeResponse(value)) {
    return false;
  }

  const state = Reflect.get(value, "state");
  return value.ok
    ? isExtensionState(state)
    : state === undefined || isExtensionState(state);
}
