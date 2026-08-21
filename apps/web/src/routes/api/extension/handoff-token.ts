import type { APIEvent } from "filesystem-routing/api";

import { ContactAssignmentId } from "~/domain/ids";
import { getApplication } from "~/server/composition/application";
import { isCreateExtensionHandoffTokenRequest } from "~/server/extension/contracts";
import { toWire } from "~/server/platform/action/domain-error";
import { getRequestOperation } from "~/server/platform/http/request-context-storage";
import { authorizeRoutePermission } from "~/server/platform/http/route-access";
import { isErr } from "~/shared/result";

import { readJsonBody } from "./json-body";

export async function POST(event: APIEvent): Promise<Response> {
  const parsed = await readJsonBody(event.request);

  if (!parsed.ok) {
    return parsed.response;
  }

  if (!isCreateExtensionHandoffTokenRequest(parsed.body)) {
    return Response.json(
      { error: "Invalid handoff token request" },
      { status: 400 },
    );
  }

  const assignmentId = ContactAssignmentId.parse(parsed.body.assignmentId);

  if (isErr(assignmentId)) {
    return Response.json(
      { error: "Invalid handoff token request" },
      { status: 400 },
    );
  }

  const auth = await authorizeRoutePermission("lead:work");

  if (isErr(auth)) {
    return auth.error;
  }

  const session = auth.value;
  const origin = event.request.headers.get("origin") ?? "";

  const result = await getApplication().extension.createHandoffToken(
    {
      userId: session.userId,
      authSessionId: session.id,
      branchId: session.branchId,
      assignmentId: assignmentId.value,
      origin,
    },
    getRequestOperation(),
  );

  if (isErr(result)) {
    let status: number;

    switch (result.error.code) {
      case "assignment_not_found":
        status = 404;
        break;
      case "assignment_inactive":
        status = 409;
        break;
      case "invalid_origin":
        status = 403;
        break;
      case "misconfigured":
        status = 503;
        break;
      default:
        status = 500;
    }

    return Response.json({ error: toWire(result.error).message }, { status });
  }

  return Response.json(result.value, { status: 200 });
}
