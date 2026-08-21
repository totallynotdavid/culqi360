import type { BridgeResponse } from "@crm/contracts/extension";
import { isBridgeResponse } from "@crm/contracts/extension";

import { isPlainRecord } from "~/shared/type-guards";

interface AssignmentHandoffMessage {
  type: "assignment.handoff";
  token: string;
}

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

function bridgeUnavailable(message: string): BridgeResponse {
  return { ok: false, error: message };
}

async function sendMessage(
  message: AssignmentHandoffMessage,
): Promise<BridgeResponse> {
  const extensionId = getExtensionId();

  if (!extensionId) {
    return bridgeUnavailable("La extensión no está configurada.");
  }

  const runtime = getChromeRuntime();

  if (!runtime) {
    return bridgeUnavailable(
      "La extensión no está disponible en este navegador.",
    );
  }

  return new Promise((resolve) => {
    runtime.sendMessage(extensionId, message, (response?: unknown) => {
      const runtimeError = runtime.lastError?.message;

      if (runtimeError) {
        resolve(bridgeUnavailable(runtimeError));
        return;
      }

      if (!isRuntimeResponse(response)) {
        resolve(
          bridgeUnavailable("La extensión devolvió una respuesta no válida."),
        );
        return;
      }

      resolve(response);
    });
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

  send.call(runtime, { action: "focusWindow" });
}

export async function handoffLeadToExtension(input: {
  token: string;
}): Promise<BridgeResponse> {
  const token = input.token.trim();

  if (!token) {
    return bridgeUnavailable("Missing extension handoff token.");
  }

  return sendMessage({
    type: "assignment.handoff",
    token,
  });
}
