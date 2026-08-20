import { useAction, useNavigate } from "@solidjs/router";
import { createMemo, createSignal, onSettled } from "solid-js";

import {
  createAuthenticationResponse,
  isPasskeyAuthenticationSupported,
} from "~/browser/auth/passkey/authentication-client";
import { codeIs } from "~/contracts/error-codes";
import { actionErrorMessage, parseWireError } from "~/contracts/errors";
import type { PasskeyLoginFlowState } from "~/domain/auth/passkey/types";
import { trackAuthClientEventMutation } from "~/features/auth/data/analytics-mutations";
import { passkeyStartMutation } from "~/features/auth/data/mutations";
import { finishPasskeyLogin } from "~/rpc/auth/login/passkey";

type PasskeyLoginPhase = "idle" | "starting" | "device" | "verifying";
type PasskeySupportStatus = "unknown" | "supported" | "unsupported";

function buildPasskeyStartFormData(
  input:
    | {
        mode: "identified";
        identifier: string;
      }
    | {
        mode: "discoverable";
      },
): FormData {
  const formData = new FormData();
  formData.set("mode", input.mode);

  if (input.mode === "identified") {
    formData.set("identifier", input.identifier);
  }

  return formData;
}

export function usePasskeyLogin() {
  const navigate = useNavigate();
  const beginPasskeyLogin = useAction(passkeyStartMutation);
  const trackAuthClientEvent = useAction(trackAuthClientEventMutation);

  const [phase, setPhase] = createSignal<PasskeyLoginPhase>("idle");
  const [errorMessage, setErrorMessage] = createSignal<string>();
  const [activeFlow, setActiveFlow] = createSignal<PasskeyLoginFlowState>();
  const [supportStatus, setSupportStatus] =
    createSignal<PasskeySupportStatus>("unknown");

  const supported = createMemo(() => supportStatus() === "supported");
  const supportKnown = createMemo(() => supportStatus() !== "unknown");
  const busy = createMemo(() => phase() !== "idle");

  onSettled(() => {
    setSupportStatus(
      isPasskeyAuthenticationSupported() ? "supported" : "unsupported",
    );
  });

  function clearErrorMessage() {
    setErrorMessage(undefined);
  }

  function clear() {
    setPhase("idle");
    setErrorMessage(undefined);
    setActiveFlow(undefined);
  }

  async function markUnsupported() {
    setErrorMessage("Este navegador no admite claves de acceso.");

    await trackAuthClientEvent({
      kind: "passkey_result",
      outcome: "failed",
      code: "unsupported",
    });
  }

  async function continueFlow(flow: PasskeyLoginFlowState): Promise<boolean> {
    setActiveFlow(flow);
    setErrorMessage(undefined);

    if (!supported()) {
      await markUnsupported();
      return false;
    }

    setPhase("device");

    try {
      const response = await createAuthenticationResponse(flow.requestOptions);

      setPhase("verifying");

      const { redirectTo } = await finishPasskeyLogin(flow.id, response);

      navigate(redirectTo);
      return true;
    } catch (caught: unknown) {
      if (
        caught instanceof DOMException &&
        (caught.name === "NotAllowedError" || caught.name === "AbortError")
      ) {
        await trackAuthClientEvent({
          kind: "passkey_result",
          outcome: "failed",
          code: "cancelled",
        });

        setErrorMessage(
          "La verificación con clave de acceso se canceló. Intenta de nuevo.",
        );

        return false;
      }

      const wire = parseWireError(caught);

      if (wire.kind !== "internal") {
        setErrorMessage(wire.message);

        if (codeIs(wire, "flow_expired")) {
          setActiveFlow(undefined);
        }

        return false;
      }

      await trackAuthClientEvent({
        kind: "passkey_result",
        outcome: "failed",
        code: "server_error",
      });

      setErrorMessage("No se pudo iniciar sesión con la clave de acceso.");
      return false;
    } finally {
      setPhase("idle");
    }
  }

  async function start(identifier: string): Promise<boolean> {
    const safeIdentifier = identifier.trim();

    if (!safeIdentifier || busy()) {
      return false;
    }

    clearErrorMessage();
    setPhase("starting");

    try {
      const { flow } = await beginPasskeyLogin(
        buildPasskeyStartFormData({
          mode: "identified",
          identifier: safeIdentifier,
        }),
      );

      return continueFlow(flow);
    } catch (caught: unknown) {
      setErrorMessage(actionErrorMessage(caught));
      return false;
    } finally {
      if (phase() === "starting") {
        setPhase("idle");
      }
    }
  }

  async function startDiscoverable(): Promise<boolean> {
    if (busy()) {
      return false;
    }

    clearErrorMessage();
    setPhase("starting");

    try {
      const { flow } = await beginPasskeyLogin(
        buildPasskeyStartFormData({ mode: "discoverable" }),
      );

      return continueFlow(flow);
    } catch (caught: unknown) {
      setErrorMessage(actionErrorMessage(caught));
      return false;
    } finally {
      if (phase() === "starting") {
        setPhase("idle");
      }
    }
  }

  async function retry(): Promise<boolean> {
    const flow = activeFlow();

    if (!flow || busy()) {
      return false;
    }

    return continueFlow(flow);
  }

  return {
    phase,
    errorMessage,
    supportStatus,
    supportKnown,
    supported,
    busy,
    activeFlow,
    start,
    startDiscoverable,
    retry,
    continueFlow,
    clearErrorMessage,
    clear,
  };
}
