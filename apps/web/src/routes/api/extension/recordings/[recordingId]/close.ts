import { isCloseRecordingRequest } from "@crm/contracts/extension";
import type { APIEvent } from "filesystem-routing/api";

import { getApplication } from "~/server/composition/application";
import { getRequestOperation } from "~/server/platform/http/request-context-storage";
import { isErr } from "~/shared/result";

import { readJsonBody } from "../../json-body";
import { extensionErrorResponse, getBearerToken } from "../../response";

export async function POST(event: APIEvent): Promise<Response> {
  try {
    const sessionToken = getBearerToken(event.request);
    if (!sessionToken) {
      return new Response("Unauthorized", { status: 401 });
    }

    const recordingId = event.params?.recordingId;
    if (!recordingId) {
      return new Response("Not found", { status: 404 });
    }

    const parsed = await readJsonBody(event.request);
    if (!parsed.ok) {
      return parsed.response;
    }
    if (!isCloseRecordingRequest(parsed.body)) {
      return Response.json(
        { error: "Invalid recording manifest" },
        { status: 400 },
      );
    }

    const result = await getApplication().extension.closeRecording(
      {
        sessionToken,
        recordingId,
        segments: parsed.body.segments,
        bytes: parsed.body.bytes,
        interrupted: parsed.body.interrupted,
      },
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
