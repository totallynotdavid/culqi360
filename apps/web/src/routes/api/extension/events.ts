import type { APIEvent } from "filesystem-routing/api";

import { getApplication } from "~/server/composition/application";
import { isExtensionRuntimeEventEnvelope } from "~/server/extension/contracts";
import { toWire } from "~/server/platform/action/domain-error";
import { getRequestOperation } from "~/server/platform/http/request-context-storage";
import { isErr } from "~/shared/result";

import { readJsonBody } from "./json-body";

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();

  return token === "" ? null : token;
}

export async function POST(event: APIEvent): Promise<Response> {
  try {
    const sessionToken = getBearerToken(event.request);

    if (!sessionToken) {
      return new Response("Unauthorized", { status: 401 });
    }

    const parsed = await readJsonBody(event.request);

    if (!parsed.ok) {
      return parsed.response;
    }

    if (!isExtensionRuntimeEventEnvelope(parsed.body)) {
      return Response.json(
        { error: "Invalid extension event payload" },
        { status: 400 },
      );
    }

    const result = await getApplication().extension.ingestRuntimeEvent(
      {
        sessionToken,
        event: parsed.body,
      },
      getRequestOperation(),
    );

    if (isErr(result)) {
      const status =
        result.error.code === "extension_session_invalid"
          ? 401
          : result.error.code === "misconfigured"
            ? 503
            : 500;

      return Response.json({ error: toWire(result.error).message }, { status });
    }

    return Response.json({ ok: true });
  } catch {
    return new Response("Unexpected error", { status: 500 });
  }
}
