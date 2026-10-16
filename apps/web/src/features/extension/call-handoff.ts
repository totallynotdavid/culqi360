import { createSignal, type Accessor } from "solid-js";

import { Err, isErr, Ok, type Result } from "~/shared/result";
import { isPlainRecord } from "~/shared/type-guards";

import { handoffLeadToExtension } from "./runtime";

export type CallHandoffState =
  | { phase: "idle" }
  | { phase: "pending" }
  | { phase: "unreachable"; reason: string }
  | { phase: "refused"; reason: string }
  | { phase: "handed-off" };

export interface CallHandoff {
  state: Accessor<CallHandoffState>;
  start: () => Promise<void>;
}

const HANDOFF_TOKEN_PATH = "/api/extension/handoff-token";

async function requestHandoffToken(
  assignmentId: string,
): Promise<Result<string, string>> {
  let response: Response;

  try {
    response = await fetch(HANDOFF_TOKEN_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assignmentId }),
    });
  } catch {
    return Err("No se pudo contactar al servidor.");
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = isPlainRecord(body) ? body.error : null;

    return Err(
      typeof message === "string" && message !== ""
        ? message
        : `El servidor rechazó la solicitud (${response.status}).`,
    );
  }

  if (!isPlainRecord(body) || typeof body.handoffToken !== "string") {
    return Err("El servidor devolvió una respuesta no válida.");
  }

  return Ok(body.handoffToken);
}

async function runHandoff(assignmentId: string): Promise<CallHandoffState> {
  const token = await requestHandoffToken(assignmentId);

  if (isErr(token)) {
    return { phase: "refused", reason: token.error };
  }

  const outcome = await handoffLeadToExtension({ token: token.value });

  switch (outcome.status) {
    case "unreachable":
      return { phase: "unreachable", reason: outcome.reason };
    case "refused":
      return { phase: "refused", reason: outcome.reason };
    case "accepted":
      return { phase: "handed-off" };
    default:
      return outcome satisfies never;
  }
}

export function createCallHandoff(assignmentId: Accessor<string>): CallHandoff {
  const [state, setState] = createSignal<CallHandoffState>({ phase: "idle" });

  // Solid signals flush later, so the click guard must be a plain flag.
  let inFlight = false;

  async function start(): Promise<void> {
    if (inFlight) {
      return;
    }

    inFlight = true;
    setState({ phase: "pending" });

    try {
      setState(await runHandoff(assignmentId()));
    } finally {
      inFlight = false;
    }
  }

  return { state, start };
}
