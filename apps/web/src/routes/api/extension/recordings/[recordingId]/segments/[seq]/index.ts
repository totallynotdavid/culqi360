import {
  EXTENSION_SEGMENT_CHANNELS_HEADER,
  EXTENSION_SEGMENT_MAX_BYTES,
  EXTENSION_SEGMENT_STARTED_AT_HEADER,
} from "@crm/contracts/extension";
import type { APIEvent } from "filesystem-routing/api";

import { invalid } from "~/domain/errors";
import { getApplication } from "~/server/composition/application";
import { getRequestOperation } from "~/server/platform/http/request-context-storage";
import { isErr } from "~/shared/result";

import { extensionErrorResponse, getBearerToken } from "../../../../response";
import { readBodyUpTo } from "../../../../segment-body";

// Number("") is 0 and Number(" 7 ") is 7. The service accepts only plain
// non-negative integers, so anything else becomes NaN and is rejected there.
function parseInteger(value: string | null | undefined): number {
  return value !== null && value !== undefined && /^\d+$/.test(value)
    ? Number(value)
    : Number.NaN;
}

// The order is: declared length, then session and recording (inside the
// service), then the body. A request that is refused must not cost a body read,
// and the service calls `readBody` only once it has accepted the request.
export async function PUT(event: APIEvent): Promise<Response> {
  try {
    const { headers } = event.request;
    if (
      parseInteger(headers.get("content-length")) > EXTENSION_SEGMENT_MAX_BYTES
    ) {
      return extensionErrorResponse(invalid({ code: "segment_too_large" }));
    }

    const sessionToken = getBearerToken(event.request);
    if (!sessionToken) {
      return new Response("Unauthorized", { status: 401 });
    }

    const recordingId = event.params?.recordingId;
    if (!recordingId) {
      return new Response("Not found", { status: 404 });
    }

    const result = await getApplication().extension.putSegment(
      {
        sessionToken,
        recordingId,
        seq: parseInteger(event.params?.seq),
        contentType: headers.get("content-type") ?? "",
        channels: headers.get(EXTENSION_SEGMENT_CHANNELS_HEADER) ?? "",
        startedAt: parseInteger(
          headers.get(EXTENSION_SEGMENT_STARTED_AT_HEADER),
        ),
        readBody: () =>
          readBodyUpTo(event.request, EXTENSION_SEGMENT_MAX_BYTES),
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
