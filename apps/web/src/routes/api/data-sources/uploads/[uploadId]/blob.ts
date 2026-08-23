import type { APIEvent } from "filesystem-routing/api";

import { hasPermission } from "~/domain/auth/access/rbac";
import type { DomainError } from "~/domain/errors";
import { getApplication } from "~/server/composition/application";
import { toWire } from "~/server/platform/action/domain-error";
import { getSession } from "~/server/platform/action/session";
import { HTTP_STATUS_BY_WIRE_KIND } from "~/server/platform/http/wire-status";
import { isErr } from "~/shared/result";

function domainErrorResponse(error: DomainError): Response {
  const wire = toWire(error);

  return Response.json(
    { code: wire.code, message: wire.message },
    { status: HTTP_STATUS_BY_WIRE_KIND[wire.kind] },
  );
}

// Keep the request body streamed; buffering it defeats the two-phase upload.
export async function PUT(event: APIEvent): Promise<Response> {
  try {
    const session = await getSession();

    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!hasPermission(session.role, "data-source:import")) {
      return new Response("Forbidden", { status: 403 });
    }

    const uploadId = event.params?.uploadId;

    if (!uploadId) {
      return new Response("Not found", { status: 404 });
    }

    const contentLength = Number(event.request.headers.get("content-length"));

    if (!Number.isFinite(contentLength) || contentLength <= 0) {
      return new Response("content-length header is required", {
        status: 400,
      });
    }

    const body = event.request.body;

    if (!body) {
      return new Response("Request body is required", { status: 400 });
    }

    const application = getApplication();
    const result = await application.dataSourceUploads.uploadBlob(
      uploadId,
      body,
      contentLength,
    );

    if (isErr(result)) {
      return domainErrorResponse(result.error);
    }

    // Accepting the blob is what starts the engine working, so this is where the
    // server takes over following it. The browser subscribes and never polls.
    application.ingestJobs.track(result.value.jobId);

    return Response.json(result.value, { status: 200 });
  } catch {
    return new Response("Unexpected error", { status: 500 });
  }
}
