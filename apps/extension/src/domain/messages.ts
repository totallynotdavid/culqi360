import type { BridgeResponse } from "@crm/contracts/extension";
export type { ExternalRuntimeMessage } from "@crm/contracts/extension";
export { isExternalRuntimeMessage } from "@crm/contracts/extension";
import { isBridgeResponse } from "@crm/contracts/extension";

import type { ExtensionState } from "./model";

export type RuntimeMessage =
  | {
      type: "state.get";
    }
  | {
      type: "call.start";
      assignmentId?: string;
      contactId?: string;
      phone?: string;
    }
  | {
      type: "call.connected";
    }
  | {
      type: "call.end";
      outcome?: string;
      notes?: string;
    }
  | {
      type: "recording.start";
      tabId: number;
    }
  | {
      type: "recording.stop";
    }
  | {
      type: "recording.chunk";
      sessionId: string;
      chunkId: string;
      mimeType: string;
      dataBase64: string;
      durationMs: number;
      createdAt: number;
    }
  | {
      type: "recording.completed";
      sessionId: string;
      createdAt: number;
    }
  | {
      type: "sync.flush";
    }
  | {
      type: "sync.configure";
      apiBaseUrl: string;
      sessionToken: string;
      refreshToken: string;
    };

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

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (!isObject(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "state.get":
    case "call.connected":
    case "recording.stop":
    case "sync.flush":
      return true;
    case "call.start":
      return (
        (value.assignmentId === undefined ||
          typeof value.assignmentId === "string") &&
        (value.contactId === undefined ||
          typeof value.contactId === "string") &&
        (value.phone === undefined || typeof value.phone === "string")
      );
    case "call.end":
      return (
        (value.outcome === undefined || typeof value.outcome === "string") &&
        (value.notes === undefined || typeof value.notes === "string")
      );
    case "recording.start":
      return typeof value.tabId === "number";
    case "recording.chunk":
      return (
        typeof value.sessionId === "string" &&
        typeof value.chunkId === "string" &&
        typeof value.mimeType === "string" &&
        typeof value.dataBase64 === "string" &&
        typeof value.durationMs === "number" &&
        typeof value.createdAt === "number"
      );
    case "recording.completed":
      return (
        typeof value.sessionId === "string" &&
        typeof value.createdAt === "number"
      );
    case "sync.configure":
      return (
        typeof value.apiBaseUrl === "string" &&
        typeof value.sessionToken === "string" &&
        typeof value.refreshToken === "string"
      );
    default:
      return false;
  }
}

export function isRuntimeResponse(value: unknown): value is RuntimeResponse {
  if (!isObject(value) || !isBridgeResponse(value)) {
    return false;
  }

  const state = Reflect.get(value, "state");
  if (value.ok) {
    return isObject(state) && state.schemaVersion === 1;
  }

  return state === undefined || (isObject(state) && state.schemaVersion === 1);
}
