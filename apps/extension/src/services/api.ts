import {
  EXTENSION_SESSION_REFRESH_PATH,
  isRefreshExtensionSessionResponse,
} from "@crm/contracts/extension";

import type { SessionRecord } from "@/src/domain/model";

/** How a request ended. A 401 means the tokens need to be refreshed. */
export type Reply =
  | { kind: "ok"; response: Response }
  | { kind: "unauthorized" }
  | { kind: "retry"; error: string };

async function describeFailure(
  label: string,
  response: Response,
): Promise<string> {
  const base = `${label} failed with status ${response.status}`;
  const body: unknown = await response.json().catch(() => null);
  const message =
    typeof body === "object" && body !== null
      ? Reflect.get(body, "error")
      : null;
  return typeof message === "string" && message !== ""
    ? `${base}: ${message}`
    : base;
}

async function classify(label: string, response: Response): Promise<Reply> {
  if (response.ok) {
    return { kind: "ok", response };
  }
  if (response.status === 401) {
    return { kind: "unauthorized" };
  }
  return { kind: "retry", error: await describeFailure(label, response) };
}

export async function callApi(
  session: SessionRecord,
  path: string,
  init: { method: string; headers?: Record<string, string>; body: BodyInit },
): Promise<Reply> {
  const label = `${init.method} ${path}`;
  try {
    const response = await fetch(`${session.origin}${path}`, {
      method: init.method,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: init.body,
    });
    return await classify(label, response);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "network error";
    return { kind: "retry", error: `${label} failed: ${reason}` };
  }
}

export type Refresh =
  | { kind: "refreshed"; session: SessionRecord }
  | { kind: "refused" }
  | { kind: "failed"; error: string };

/** Rotates the tokens. Only a 401 means the agent has to hand off again. */
export async function refreshSession(session: SessionRecord): Promise<Refresh> {
  if (session.refreshToken === null) {
    return { kind: "refused" };
  }

  try {
    const response = await fetch(
      `${session.origin}${EXTENSION_SESSION_REFRESH_PATH}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          refreshToken: session.refreshToken,
          installationId: session.installationId,
        }),
      },
    );
    if (response.status === 401) {
      return { kind: "refused" };
    }
    if (!response.ok) {
      return {
        kind: "failed",
        error: await describeFailure("session refresh", response),
      };
    }

    const body: unknown = await response.json().catch(() => null);
    if (!isRefreshExtensionSessionResponse(body)) {
      return { kind: "failed", error: "session refresh returned bad tokens" };
    }
    return {
      kind: "refreshed",
      session: {
        ...session,
        sessionToken: body.sessionToken,
        refreshToken: body.refreshToken,
      },
    };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "network error";
    return { kind: "failed", error: `session refresh failed: ${reason}` };
  }
}
