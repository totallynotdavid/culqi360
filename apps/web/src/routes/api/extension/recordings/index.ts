import { isCreateRecordingRequest } from "@crm/contracts/extension";
import type { APIEvent } from "filesystem-routing/api";

import { getApplication } from "~/server/composition/application";
import { getRequestOperation } from "~/server/platform/http/request-context-storage";
import { isErr } from "~/shared/result";

import { readJsonBody } from "../json-body";
import { extensionErrorResponse, getBearerToken } from "../response";

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
    if (!isCreateRecordingRequest(parsed.body)) {
      return Response.json(
        { error: "Invalid create recording request" },
        { status: 400 },
      );
    }

    const result = await getApplication().extension.createRecording(
      { sessionToken, callId: parsed.body.callId },
      getRequestOperation(),
    );
    if (isErr(result)) {
      return extensionErrorResponse(result.error);
    }

    return Response.json(result.value, { status: 200 });
  } catch {
    return new Response("Unexpected error", { status: 500 });
  }
}
