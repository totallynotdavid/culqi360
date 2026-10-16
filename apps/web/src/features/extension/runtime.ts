import type {
  AssignmentHandoffMessage,
  BridgeResponse,
  ExecutiveStateSnapshot,
} from "@crm/contracts/extension";
import { isBridgeResponse } from "@crm/contracts/extension";

import { isPlainRecord } from "~/shared/type-guards";

/**
 * `unreachable` means no extension answered (not configured, not installed,
 * or this page is not in its `externally_connectable` list). `refused` means
 * the extension answered and said no.
 */
export type HandoffOutcome =
  | { status: "unreachable"; reason: string }
  | {
      status: "refused";
      reason: string;
      executiveState?: ExecutiveStateSnapshot;
    }
  | { status: "accepted"; executiveState: ExecutiveStateSnapshot };

type ExtensionReply = BridgeResponse | { unreachable: string };

interface ChromeRuntimeApi {
  lastError?: { message?: string };
  sendMessage: (
    extensionId: string,
    message: AssignmentHandoffMessage,
    callback: (response?: unknown) => void,
  ) => void;
}

export function isRuntimeResponse(value: unknown): value is BridgeResponse {
  return isBridgeResponse(value);
}

function getChromeRuntimeValue(): unknown {
  const chrome = Reflect.get(globalThis, "chrome");

  if (!isPlainRecord(chrome)) {
    return null;
  }

  return Reflect.get(chrome, "runtime");
}

function isChromeRuntimeApi(value: unknown): value is ChromeRuntimeApi {
  return isPlainRecord(value) && typeof value.sendMessage === "function";
}

function getChromeRuntime(): ChromeRuntimeApi | null {
  const runtime = getChromeRuntimeValue();

  return isChromeRuntimeApi(runtime) ? runtime : null;
}

export function getExtensionId(): string | null {
  const value = import.meta.env.VITE_CRM_EXTENSION_ID;

  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function unreachable(reason: string): ExtensionReply {
  return { unreachable: reason };
}

// Chrome exposes `chrome.runtime.sendMessage` to a web page only when an
// installed extension lists the page in `externally_connectable`. A missing
// function or a `lastError` after the call means no extension is listening.
async function sendMessage(
  message: AssignmentHandoffMessage,
): Promise<ExtensionReply> {
  const extensionId = getExtensionId();

  if (!extensionId) {
    return unreachable("La extensión no está configurada.");
  }

  const runtime = getChromeRuntime();

  if (!runtime) {
    return unreachable("La extensión no está disponible en este navegador.");
  }

  return new Promise((resolve) => {
    const onReply = (response?: unknown) => {
      const runtimeError = runtime.lastError?.message;

      if (runtimeError) {
        resolve(unreachable(runtimeError));
        return;
      }

      if (!isRuntimeResponse(response)) {
        resolve({
          ok: false,
          error: "La extensión devolvió una respuesta no válida.",
        });
        return;
      }

      resolve(response);
    };

    // Chrome throws synchronously, instead of setting `lastError`, for an
    // extension id that is malformed or a message it cannot serialize.
    try {
      runtime.sendMessage(extensionId, message, onReply);
    } catch (error) {
      resolve(
        unreachable(error instanceof Error ? error.message : String(error)),
      );
    }
  });
}

export function focusExtensionWindow(): void {
  const runtime = getChromeRuntimeValue();

  if (!isPlainRecord(runtime)) {
    return;
  }

  const send = Reflect.get(runtime, "sendMessage");

  if (typeof send !== "function") {
    return;
  }

  try {
    send.call(runtime, { action: "focusWindow" });
  } catch {
    // Focusing is best effort. Opening the extension must not break the page.
  }
}

export async function handoffLeadToExtension(input: {
  token: string;
}): Promise<HandoffOutcome> {
  const reply = await sendMessage({
    type: "assignment.handoff",
    token: input.token,
  });

  if ("unreachable" in reply) {
    return { status: "unreachable", reason: reply.unreachable };
  }

  if (!reply.ok) {
    return {
      status: "refused",
      reason: reply.error,
      executiveState: reply.executiveState,
    };
  }

  return { status: "accepted", executiveState: reply.executiveState };
}
