import type { APIEvent } from "filesystem-routing/api";

import { getApplication } from "~/server/composition/application";
import { isRefreshExtensionSessionRequest } from "~/server/extension/contracts";
import { toWire } from "~/server/platform/action/domain-error";
import { getRequestOperation } from "~/server/platform/http/request-context-storage";
import { isErr } from "~/shared/result";

import { readJsonBody } from "../json-body";

export async function POST(event: APIEvent): Promise<Response> {
  try {
    const parsed = await readJsonBody(event.request);
    if (!parsed.ok) {
      return parsed.response;
    }
    const body = parsed.body;
    if (!isRefreshExtensionSessionRequest(body)) {
      return Response.json(
        { error: "Invalid extension session refresh request" },
        { status: 400 },
      );
    }

    const result = await getApplication().extension.refreshInstallationSession(
      body,
      getRequestOperation(),
    );
    if (isErr(result)) {
      const status =
        result.error.code === "installation_invalid"
          ? 400
          : result.error.code === "extension_session_invalid"
            ? 401
            : result.error.code === "misconfigured"
              ? 503
              : 500;
      return Response.json({ error: toWire(result.error).message }, { status });
    }

    return Response.json(result.value, { status: 200 });
  } catch {
    return new Response("Unexpected error", { status: 500 });
  }
}
